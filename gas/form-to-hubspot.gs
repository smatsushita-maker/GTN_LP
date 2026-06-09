/**
 * GTN 診断フォーム → HubSpot コンタクト連携（方式A: GAS→HubSpot）
 * ============================================================
 * 役割:
 *   result.html のフォーム送信を受ける「既存の doPost」が持つ payload を、
 *   HubSpot のコンタクトへ upsert（無ければ作成 / あれば更新）する。
 *   レポートメール送信・スプレッドシート記録などの既存処理は一切変更しない。
 *   この HubSpot 連携は「付帯・非ブロッキング」。失敗してもフォーム送信
 *   （＝コンバージョン）は止めない（受け入れ条件 4-1）。
 *
 * フロントから届く payload（抜粋）:
 *   { email, company, name, meta: { role: 'executive', ... }, score, rating, ... }
 *   ・email   … 必須キー（コンタクトの突合キー）
 *   ・company … 会社名（任意で更新）
 *   ・name    … お名前（任意・未入力あり得る → firstname に格納）
 *   ・meta    … 診断メタの汎用集合。role が初出。将来 timeline 等を追加可能。
 *
 * ── セットアップ手順 ─────────────────────────────────────────
 *   1) HubSpot で「Private App」を作成
 *      Settings → Integrations → Private Apps → Create a private app
 *      Scopes（最小）: crm.objects.contacts.read / crm.objects.contacts.write
 *      ※ プロパティを下記 setup 関数で自動作成する場合は
 *        crm.schemas.contacts.read / crm.schemas.contacts.write も付与
 *   2) 発行されたアクセストークンを Apps Script のスクリプトプロパティに登録
 *      Apps Script エディタ → プロジェクトの設定（⚙）→ スクリプト プロパティ
 *      キー: HUBSPOT_TOKEN  値: （Private App のトークン）
 *   3) setupHubSpotProperties() を「一度だけ」手動実行
 *      → gtn_diagnosis_role（立場）プロパティを作成（既にあればスキップ）
 *      ※ HubSpot UI で手動作成済みなら本手順は不要（実行しても既存検知でスキップ）
 *   4) 既存 doPost の本文末尾に1行だけ追加（下の「組み込み例」参照）
 *        upsertHubSpotContact_(data);   // data は JSON.parse 済みの payload
 *
 * ── 将来の拡張（例: 検討時期 timeline）─────────────────────────
 *   A) フロント: app.js の META_QUESTIONS に timeline 定義を1つ追加（キーは安定キー timeline のまま）
 *   B) HubSpot : 下の GTN_PROPERTY_DEFS に gtn_diagnosis_timeline 定義を足して
 *               setupHubSpotProperties() を再実行（または UI で作成）
 *   C) マッピング: GTN_META_PROPERTY_MAP に timeline:'gtn_diagnosis_timeline' を追加
 *               （上書き禁止にするなら GTN_SET_IF_EMPTY にも 'gtn_diagnosis_timeline' 追加）
 *   → upsert / 受け渡しのロジックは書き換え不要。
 * ============================================================
 */

/* =========================================================
   設定（拡張ポイントはここだけ）
   ========================================================= */

/** 診断メタのキー → HubSpot コンタクトプロパティ名 のマッピング
 *  ※ HubSpot 側は診断由来と分かる gtn_diagnosis_* 接頭辞で統一する。
 *    フロントの安定キー(role 等)は変えず、ここの対応付けだけで吸収する。 */
var GTN_META_PROPERTY_MAP = {
  role: 'gtn_diagnosis_role',
  // timeline: 'gtn_diagnosis_timeline',   // ← 将来追加する場合の例
};

/** Google広告アトリビューション（トップレベル payload）→ HubSpot コンタクトプロパティ。
 *  方針 2026-06: 初回接点（first-touch）を保持する。
 *    → 既存値が空のときだけ書き込み、以後の再送信では上書きしない。
 *    （role は「毎回最新で上書き」だが、アトリビューションは逆に初回を守る） */
/** Google広告アトリビューション（トップレベル payload）→ HubSpot コンタクトプロパティ。
 *  方針 2026-06: 初回接点（first-touch）を保持する。
 *    → 既存値が空のときだけ書き込み、以後の再送信では上書きしない。
 *    （role は「毎回最新で上書き」だが、アトリビューションは逆に初回を守る）
 *  ※ 内部名は HubSpot 側の実プロパティ（gtn_*）に一致。連携検証済み 2026-06-09。 */
var GTN_ATTR_PROPERTY_MAP = {
  gclid:        'gtn_gclid',
  utm_source:   'gtn_utm_source',
  utm_medium:   'gtn_utm_medium',
  utm_campaign: 'gtn_utm_campaign',
};

/**
 * 「既存値が空のときだけ書き込む（＝上書きしない）」プロパティの一覧。
 * ここに載せた内部名は既存値を保護する。載せなければ毎回・最新値で上書きする。
 *
 * 【方針 2026-06】gtn_diagnosis_role は「毎回・最新の診断値で上書き」。
 *   理由: 再診断時は最新の立場でセグメント追客したいため（履歴より最新優先）。
 *   → よってこの配列には含めない（空のまま）。
 *   将来「初回値を保持したい」項目が出たら、その内部名をここへ追加するだけで切替可能。
 */
var GTN_SET_IF_EMPTY = [
  // 例) 'gtn_diagnosis_first_touch',  // 初回値を保持したい項目があればここへ
];

/** setupHubSpotProperties() で作成するカスタムプロパティ定義 */
var GTN_PROPERTY_DEFS = [
  {
    name: 'gtn_diagnosis_role',
    label: '立場',
    description: '診断LPで取得した回答者の立場（CVR追客のセグメント分岐用）',
    groupName: 'contactinformation',
    type: 'enumeration',
    fieldType: 'select',
    options: [
      { label: '経営者・役員',   value: 'executive',    displayOrder: 0 },
      { label: '人事・採用担当', value: 'hr',           displayOrder: 1 },
      { label: '現場責任者',     value: 'site_manager', displayOrder: 2 },
      { label: 'その他',         value: 'other',        displayOrder: 3 },
    ],
  },
  // Google広告アトリビューション（初回接点保持・set-if-empty）
  // ※ 内部名は HubSpot 側の実プロパティ（gtn_*）に一致。setup再実行時は既存検知でスキップ。
  { name: 'gtn_gclid',        label: 'Google Click ID (gclid)', description: '広告クリックID。初回接点を保持（CV→広告照合用）', groupName: 'contactinformation', type: 'string', fieldType: 'text' },
  { name: 'gtn_utm_source',   label: 'utm_source',              description: '流入元（初回接点を保持）',           groupName: 'contactinformation', type: 'string', fieldType: 'text' },
  { name: 'gtn_utm_medium',   label: 'utm_medium',              description: '流入メディア（初回接点を保持）',     groupName: 'contactinformation', type: 'string', fieldType: 'text' },
  { name: 'gtn_utm_campaign', label: 'utm_campaign',            description: 'キャンペーン（初回接点を保持）',     groupName: 'contactinformation', type: 'string', fieldType: 'text' },
  // 将来例:
  // {
  //   name: 'gtn_diagnosis_timeline', label: '検討時期', groupName: 'contactinformation',
  //   type: 'enumeration', fieldType: 'select',
  //   options: [
  //     { label: '今すぐ',      value: 'now',     displayOrder: 0 },
  //     { label: '3ヶ月以内',   value: 'q',       displayOrder: 1 },
  //     { label: '半年以内',    value: 'half',    displayOrder: 2 },
  //     { label: '未定',        value: 'undecided', displayOrder: 3 },
  //   ],
  // },
];

/* =========================================================
   HubSpot API 共通
   ========================================================= */

function getHubSpotToken_() {
  var t = PropertiesService.getScriptProperties().getProperty('HUBSPOT_TOKEN');
  if (!t) throw new Error('HUBSPOT_TOKEN が未設定です（スクリプトプロパティに登録してください）');
  return t;
}

function hsFetch_(url, method, body) {
  var options = {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getHubSpotToken_() },
    muteHttpExceptions: true,
  };
  if (body) options.payload = JSON.stringify(body);
  return UrlFetchApp.fetch(url, options);
}

/* =========================================================
   セットアップ: カスタムプロパティ作成（一度だけ手動実行）
   ========================================================= */

function setupHubSpotProperties() {
  GTN_PROPERTY_DEFS.forEach(function (def) {
    // 既存チェック（200 なら作成済み）
    var check = hsFetch_(
      'https://api.hubapi.com/crm/v3/properties/contacts/' + encodeURIComponent(def.name),
      'get'
    );
    if (check.getResponseCode() === 200) {
      Logger.log('既存のためスキップ: ' + def.name);
      return;
    }
    var res = hsFetch_('https://api.hubapi.com/crm/v3/properties/contacts', 'post', def);
    Logger.log('作成 ' + def.name + ' → ' + res.getResponseCode() + ' ' + res.getContentText());
  });
}

/* =========================================================
   コンタクト upsert（doPost から呼ぶ）
   ========================================================= */

/**
 * payload(data) から HubSpot コンタクトを upsert する。
 * 付帯・非ブロッキング: 例外は内部で握りつぶし、既存のフォーム処理を止めない。
 * @param {Object} data JSON.parse 済みの payload
 */
function upsertHubSpotContact_(data) {
  try {
    var email = (data && data.email) ? String(data.email).trim() : '';
    if (!email) { Logger.log('[HS] email 無し → スキップ'); return; }

    var meta = (data && data.meta && typeof data.meta === 'object') ? data.meta : {};

    // 基本プロパティ（会社名・お名前）
    var baseProps = {};
    if (data.company) baseProps.company   = String(data.company).trim();
    if (data.name)    baseProps.firstname = String(data.name).trim();  // お名前は任意

    // 診断メタ → HubSpot プロパティ（空値は送らない）
    var metaProps = {};
    Object.keys(GTN_META_PROPERTY_MAP).forEach(function (key) {
      var hsName = GTN_META_PROPERTY_MAP[key];
      var v = meta[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        metaProps[hsName] = String(v).trim();
      }
    });

    // Google広告アトリビューション（トップレベル payload・空値は送らない）
    // gclid / utm_* は first-touch を守るため、既存更新では「空のときだけ」書く（下記）。
    var attrProps = {};
    Object.keys(GTN_ATTR_PROPERTY_MAP).forEach(function (key) {
      var hsName = GTN_ATTR_PROPERTY_MAP[key];
      var v = data[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        attrProps[hsName] = String(v).trim();
      }
    });

    var existing = hsSearchContactByEmail_(email);

    // ── 新規作成 ──────────────────────────────
    if (!existing) {
      var createProps = { email: email };
      mergeInto_(createProps, baseProps);
      mergeInto_(createProps, metaProps);   // 新規は SET_IF_EMPTY 関係なく全て入れる
      mergeInto_(createProps, attrProps);   // 新規＝初回接点。アトリビューションを記録
      var createRes = hsFetch_(
        'https://api.hubapi.com/crm/v3/objects/contacts', 'post',
        { properties: createProps }
      );
      Logger.log('[HS] 新規作成 → ' + createRes.getResponseCode());
      return;
    }

    // ── 既存更新 ──────────────────────────────
    var cur = existing.properties || {};
    var updateProps = {};

    // 会社名・お名前: 既存が空のときだけ補完（既存値は尊重して上書きしない）
    Object.keys(baseProps).forEach(function (k) {
      if (!cur[k]) updateProps[k] = baseProps[k];
    });

    // メタ: SET_IF_EMPTY に載るものだけ「空のときだけ」。それ以外は毎回・最新値で上書き。
    //  ※ gtn_diagnosis_role は SET_IF_EMPTY に無い → 常に最新の診断値で上書き（方針 2026-06）
    Object.keys(metaProps).forEach(function (hsName) {
      var onlyIfEmpty = GTN_SET_IF_EMPTY.indexOf(hsName) !== -1;
      if (onlyIfEmpty) {
        if (!cur[hsName]) updateProps[hsName] = metaProps[hsName];
      } else {
        updateProps[hsName] = metaProps[hsName];
      }
    });

    // 広告アトリビューション: 初回接点保持 → 既存が空のときだけ書き込む（既存値は上書きしない）
    Object.keys(attrProps).forEach(function (hsName) {
      if (!cur[hsName]) updateProps[hsName] = attrProps[hsName];
    });

    if (Object.keys(updateProps).length === 0) {
      Logger.log('[HS] 更新項目なし（既存値を尊重）→ スキップ');
      return;
    }

    var patchRes = hsFetch_(
      'https://api.hubapi.com/crm/v3/objects/contacts/' + existing.id, 'patch',
      { properties: updateProps }
    );
    Logger.log('[HS] 既存更新 → ' + patchRes.getResponseCode());

  } catch (err) {
    // 受け入れ条件 4-1: HubSpot 連携の失敗でフォーム送信を止めない
    Logger.log('[HS] upsert エラー（無視して継続）: ' + err);
  }
}

/** email でコンタクトを1件検索（無ければ null） */
function hsSearchContactByEmail_(email) {
  var props = ['email', 'firstname', 'company'];
  Object.keys(GTN_META_PROPERTY_MAP).forEach(function (k) {
    props.push(GTN_META_PROPERTY_MAP[k]);
  });
  Object.keys(GTN_ATTR_PROPERTY_MAP).forEach(function (k) {
    props.push(GTN_ATTR_PROPERTY_MAP[k]);  // 既存値の取得（set-if-empty 判定用）
  });
  var body = {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: props,
    limit: 1,
  };
  var res = hsFetch_('https://api.hubapi.com/crm/v3/objects/contacts/search', 'post', body);
  if (res.getResponseCode() !== 200) {
    Logger.log('[HS] 検索失敗 → ' + res.getResponseCode() + ' ' + res.getContentText());
    return null;  // 検索失敗時は安全側（＝作成も更新もしない or 新規扱いにしない）
  }
  var json = JSON.parse(res.getContentText());
  return (json.results && json.results.length) ? json.results[0] : null;
}

/** src の各キーを dst にコピー（浅いマージ） */
function mergeInto_(dst, src) {
  Object.keys(src).forEach(function (k) { dst[k] = src[k]; });
}

/* =========================================================
   既存 doPost への組み込み例（※既存コードに合わせて1行追加するだけ）
   ─────────────────────────────────────────────────────────
   function doPost(e) {
     var data = JSON.parse(e.postData.contents);

     // …（既存）スプレッドシート追記・レポートメール送信など…

     upsertHubSpotContact_(data);   // ← この1行を追加（付帯・非ブロッキング）

     return ContentService
       .createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ========================================================= */
