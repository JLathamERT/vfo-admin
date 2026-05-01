// Automation











// MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1













// ============================================================
// CONFIGURATION
// ============================================================

var MASTER_SS_ID = "1haENiw6ZeJuZPSokZC8UVJLRrwTiEiJgVTtbapbU_Tw";
var PIPELINE_TAB = "MAP 1 Pipeline";
var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
var MAP1_SANDBOX = false;
var TAX_SANDBOX = false;
var STRIPE_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "STRIPE_API_KEY_SANDBOX" : "STRIPE_API_KEY");

// Pipeline column indexes (1-based)
var COL = {
  TIMESTAMP: 1,
  CLIENT_REF: 2,
  CLIENT_FIRST: 3,
  CLIENT_LAST: 4,
  CLIENT_EMAIL: 5,
  MEMBER_NUM: 6,
  MEMBER_FIRST: 7,
  MEMBER_LAST: 8,
  MEMBER_EMAIL: 9,
  PF: 10,
  TAX_PLANNER: 11,
  C81_DECISION: 12,
  C81_EMAIL_SENT: 13,
  FOLLOWUP_MEETING_DATE: 14,
  C13_DECISION: 15,
  CURRENT_PRIORITIES: 16,
  PARKED_PRIORITIES: 17,
  MEETING_NOTES: 18,
  UNDECIDED_REASON: 19,
  LITE_MEMBERSHIP: 20,
  CORE_MEMBERSHIP: 21,
  MAX_MEMBERSHIP: 22,
  C14_EMAIL_SENT: 23,
  C15_TOKEN: 24,
  C14_FOLLOWUP_SENT_DATE: 25,
  C14_FOLLOWUP1_SENT: 26,
  C14_FOLLOWUP2_SENT: 27,
  C15_FINAL_DECISION: 28,
  C15_SERVICE_LEVEL: 29,
  SERVICE_LEVEL: 30,
  PIP_MEETING_COUNT: 31,
  GROSS_FEE: 32,
  MEMBER_CONTRIBUTION: 33,
  NET_INVOICE: 34,
  MEMBER_SHARE: 35,
  VFOS_SHARE: 36,
  PAYMENT_PLAN: 37,
  C16_SENT: 38,
  BOLDSIGN_DOC_ID: 39,
  C17_CLIENT_SIGNED: 40,
  C17_FOLLOWUP_SENT_DATE: 41,
  C17_FOLLOWUP1_SENT: 42,
  C17_FOLLOWUP2_SENT: 43,
  C18_CEO_SIGNED: 44,
  STRIPE_CUSTOMER_ID: 45,
  CHECKOUT_TOKEN: 46,
  PAYMENT_METHOD_TYPE: 47,
  CARD_PROCESSING_FEE: 48,
  PAY1_FOLLOWUP_SENT_DATE: 49,
  PAY1_FOLLOWUP1_SENT: 50,
  PAY1_FOLLOWUP2_SENT: 51,
  STRIPE_BANK_TOKEN: 52,
  ACCT_LAST4: 53,
  PAY1_STATUS: 54,
  PAY1_DATE: 55,
  PAY2_STATUS: 56,
  PAY2_DATE: 57,
  PAY3_STATUS: 58,
  PAY3_DATE: 59,
  PAY4_STATUS: 60,
  PAY4_DATE: 61,
  BANK_TOKEN: 62,
  CONFIRMATION_STATUS: 63,
  INVOICE_NUMBER: 64,
  INVOICE_DRIVE_ID: 65,
  INVOICE_EMAIL_SENT: 66,
  REC1_NUMBER: 67,
  REC1_STATUS: 68,
  REC1_DRIVE_ID: 69,
  REC1_EMAIL_SENT: 70,
  REC1_REV_SHARE: 71,
  REC1_REV_PAID: 72,
  REC1_REV_EMAIL_SENT: 73,
  MEMBER_CONTRIB_STATUS: 74,
  C24_EMAIL_SENT: 75,
  SOURCE_SS_ID: 76,
  SOURCE_SHEET_NAME: 77,
  REC2_NUMBER: 78,
  REC2_STATUS: 79,
  REC2_DRIVE_ID: 80,
  REC2_EMAIL_SENT: 81,
  REC2_REV_SHARE: 82,
  REC2_REV_PAID: 83,
  REC2_REV_EMAIL_SENT: 84,
  REC3_NUMBER: 85,
  REC3_STATUS: 86,
  REC3_DRIVE_ID: 87,
  REC3_EMAIL_SENT: 88,
  REC3_REV_SHARE: 89,
  REC3_REV_PAID: 90,
  REC3_REV_EMAIL_SENT: 91,
  REC4_NUMBER: 92,
  REC4_STATUS: 93,
  REC4_DRIVE_ID: 94,
  REC4_EMAIL_SENT: 95,
  REC4_REV_SHARE: 96,
  REC4_REV_PAID: 97,
  REC4_REV_EMAIL_SENT: 98,
  EXTRA_CC: 99
};

// ============================================================
// ROUTING — doGet & doPost (Web App Entry Points)
// ============================================================

function doGet(e) {
  var action = e.parameter.action || "";

  if (action === "stripepay") {
    return handleStripePayRedirect(e.parameter);
  }
  if (action === "connectsetup") {
    return handleConnectSetupRedirect(e.parameter);
  }
  if (action === "c15") {
    return handleC15Decision(e.parameter);
  }
  if (action === "c15yes") {
    return handleC15YesForm(e.parameter);
  }
  if (action === "bankupdate") {
    var template = HtmlService.createTemplate(getBankUpdateFormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientName = e.parameter.clientName || "";
    template.paymentNumber = e.parameter.paymentNumber || "1";
    template.token = e.parameter.token || "";
    return template.evaluate()
      .setTitle("Update Bank Details")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (action === "c15yesform") {
    var template = HtmlService.createTemplate(getC15YesFormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    template.serviceLevel = e.parameter.serviceLevel || "";
    return template.evaluate()
      .setTitle("C15Yes — Complete Pricing Details")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (action === "c15extrameeting") {
    var template = HtmlService.createTemplate(getC15ExtraMeetingFormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    return template.evaluate()
      .setTitle("C15 — Extra Meeting Decision")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (action === "c15extrameetingsubmit") {
    return handleC15ExtraMeetingForm(e.parameter);
  }

  if (action === "tp1decline") {
      var template = HtmlService.createTemplate(getTP1DeclineFormHtml_());
      template.clientRef = e.parameter.clientRef || "";
      template.clientFirst = e.parameter.clientFirst || "";
      template.clientLast = e.parameter.clientLast || "";
      template.clientEmail = e.parameter.clientEmail || "";
      template.memberNum = e.parameter.memberNum || "";
      template.memberFirst = e.parameter.memberFirst || "";
      template.memberLast = e.parameter.memberLast || "";
      template.memberEmail = e.parameter.memberEmail || "";
      template.ssId = e.parameter.ssId || "";
      template.sheetName = e.parameter.sheetName || "";
      return template.evaluate()
        .setTitle("C26.5.1 — Tax Planning Decline")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (action === "c266form") {
    var template = HtmlService.createTemplate(getC266FormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.clientEmail = e.parameter.clientEmail || "";
    template.memberNum = e.parameter.memberNum || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    template.memberEmail = e.parameter.memberEmail || "";
    template.ssId = e.parameter.ssId || "";
    template.sheetName = e.parameter.sheetName || "";
    return template.evaluate()
      .setTitle("C26.6 — Schedule Tax Planning")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === "c269form") {
    var template = HtmlService.createTemplate(getC269FormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.clientEmail = e.parameter.clientEmail || "";
    template.memberNum = e.parameter.memberNum || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    template.memberEmail = e.parameter.memberEmail || "";
    template.ssId = e.parameter.ssId || "";
    template.sheetName = e.parameter.sheetName || "";
    return template.evaluate()
      .setTitle("C26.9 — Tax Planning Outcome")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === "c269decision") {
    return handleC269UndecidedDecision(e.parameter);
  }

  if (action === "c269extrameetingsubmit") {
    return handleC269ExtraMeetingForm(e.parameter);
  }
  if (action === "c269extrameeting") {
    var template = HtmlService.createTemplate(getC269ExtraMeetingFormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    return template.evaluate()
      .setTitle("C26.9 — Extra Meeting Decision")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === "taxstripepay") {
    return handleTaxStripePayRedirect(e.parameter);
  }

  if (action === "c2620decision") {
    return handleC2620UndecidedDecision(e.parameter);
  }

  if (action === "c2620form") {
    var template = HtmlService.createTemplate(getC2620FormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.clientEmail = e.parameter.clientEmail || "";
    template.memberNum = e.parameter.memberNum || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    template.memberEmail = e.parameter.memberEmail || "";
    template.ssId = e.parameter.ssId || "";
    template.sheetName = e.parameter.sheetName || "";
    return template.evaluate()
      .setTitle("C26.20 — Implementation Decision")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === "c269pfpricing" && e.parameter.retainerPayment) {
    processC269PFPricingForm(e.parameter);
    return ContentService.createTextOutput("OK");
  }
  if (action === "c269pfpricing") {
    var template = HtmlService.createTemplate(getC269PFPricingFormHtml_());
    template.clientRef = e.parameter.clientRef || "";
    template.clientFirst = e.parameter.clientFirst || "";
    template.clientLast = e.parameter.clientLast || "";
    template.memberFirst = e.parameter.memberFirst || "";
    template.memberLast = e.parameter.memberLast || "";
    template.memberNum = e.parameter.memberNum || "";
    return template.evaluate()
      .setTitle("C26.9 — Complete Pricing Details")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (e.parameter.submit === "true") {
    processC13Form(e.parameter);
    return ContentService.createTextOutput("OK");
  }

  var template = HtmlService.createTemplate(getC13FormHtml_());
  template.clientRef = e.parameter.clientRef || "";
  template.clientFirst = e.parameter.clientFirst || "";
  template.clientLast = e.parameter.clientLast || "";
  template.clientEmail = e.parameter.clientEmail || "";
  template.memberNum = e.parameter.memberNum || "";
  template.memberFirst = e.parameter.memberFirst || "";
  template.memberLast = e.parameter.memberLast || "";
  template.memberEmail = e.parameter.memberEmail || "";
  template.ssId = e.parameter.ssId || "";
  template.sheetName = e.parameter.sheetName || "";
  return template.evaluate()
    .setTitle("C13 — Update PC re Outcome")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  if (e.postData && e.postData.type === "application/json") {
    try {
      var jsonPayload = JSON.parse(e.postData.contents);
      Logger.log("doPost received JSON. Keys: " + Object.keys(jsonPayload).join(","));

      // Stripe webhook (payment_intent and checkout.session events)
      if (jsonPayload.type && (String(jsonPayload.type).indexOf("payment_intent") === 0 || String(jsonPayload.type).indexOf("checkout.session") === 0)) {
        handleStripeWebhook(jsonPayload);
        handleTaxStripeWebhook(jsonPayload);
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }

      // BoldSign webhook
      var eventType = "";
      if (jsonPayload.event && jsonPayload.event.eventType) eventType = jsonPayload.event.eventType;
      if (eventType === "Signed" || eventType === "Completed" || eventType === "SignatureCompleted") {
        handleBoldSignWebhook(jsonPayload);
        handleTaxBoldSignWebhook(jsonPayload);
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }
      if (jsonPayload.event && !jsonPayload.clientRef) {
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
      }
    } catch (err) {
      Logger.log("Webhook parse error: " + err.message);
      return ContentService.createTextOutput("Error").setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // Handle form POST (from C13 form hidden form submit)
  if (e.parameter && e.parameter.data) {
    try {
      var formData = JSON.parse(e.parameter.data);
      if (formData.clientRef && formData.clientDecision) {
        processC13Form(formData);
        return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
      }
    } catch (err) {
      Logger.log("Form data parse error: " + err.message);
    }
    return ContentService.createTextOutput("Invalid").setMimeType(ContentService.MimeType.TEXT);
  }

  // Handle JSON POST (from C13 form direct submit)
  if (e.postData && e.postData.contents) {
    try {
      var formData2 = JSON.parse(e.postData.contents);
      if (formData2.clientRef && formData2.clientDecision) {
        processC13Form(formData2);
        return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
      }
    } catch (err) {
      Logger.log("JSON POST parse error: " + err.message);
    }
  }

  // Reject everything else
  Logger.log("doPost: Unrecognized request rejected");
  return ContentService.createTextOutput("Rejected").setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// UTILITIES — Find or Create Pipeline Row
// ============================================================

/**
 * findPipelineRow — Finds existing row by Client Ref, returns row number or 0
 */
function findPipelineRow(pipeline, clientRef) {
  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return 0;
  var refs = pipeline.getRange(2, COL.CLIENT_REF, lastRow - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]).trim() === String(clientRef).trim()) {
      return i + 2;
    }
  }
  return 0;
}

/**
 * findOrCreatePipelineRow — Finds existing row or creates new one with identity fields
 */
function findOrCreatePipelineRow(pipeline, data) {
  var row = findPipelineRow(pipeline, data.clientRef);
  if (row > 0) return row;

  row = pipeline.getLastRow() + 1;
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy HH:mm:ss");
  pipeline.getRange(row, COL.TIMESTAMP).setValue(timestamp);
  pipeline.getRange(row, COL.CLIENT_REF).setValue(data.clientRef || "");
  pipeline.getRange(row, COL.CLIENT_FIRST).setValue(data.clientFirst || "");
  pipeline.getRange(row, COL.CLIENT_LAST).setValue(data.clientLast || "");
  pipeline.getRange(row, COL.CLIENT_EMAIL).setValue(data.clientEmail || "");
  pipeline.getRange(row, COL.MEMBER_NUM).setValue(data.memberNum || "");
  pipeline.getRange(row, COL.MEMBER_FIRST).setValue(data.memberFirst || "");
  pipeline.getRange(row, COL.MEMBER_LAST).setValue(data.memberLast || "");
  pipeline.getRange(row, COL.MEMBER_EMAIL).setValue(data.memberEmail || "");
  if (data.sourceSSID) pipeline.getRange(row, COL.SOURCE_SS_ID).setValue(data.sourceSSID);
  if (data.sourceSheetName) pipeline.getRange(row, COL.SOURCE_SHEET_NAME).setValue(data.sourceSheetName);
  return row;
}

/**
 * updateClientTrackingCell — Sets a cell + date on the Client Tracking sheet
 */
function updateClientTrackingCell(sourceSSID, clientRef, cell) {
  if (!sourceSSID) return;
  try {
    var sourceSS = SpreadsheetApp.openById(sourceSSID);
    var allSheets = sourceSS.getSheets();
    for (var s = 0; s < allSheets.length; s++) {
      var sht = allSheets[s];
      try {
        if (String(sht.getRange("AB1").getValue()).trim() === "Client Tracking" &&
            String(sht.getRange("A2").getValue()).trim() === clientRef) {
          var dateCol = cell.replace("G", "H");
          sht.getRange(cell).setValue("Completed");
          sht.getRange(dateCol).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/dd/yyyy"));
          Logger.log(cell + "=Completed for " + clientRef);
          break;
        }
      } catch (err) {}
    }
  } catch (err) {
    Logger.log("Could not update " + cell + ": " + err.message);
  }
}

function getPFEmail(pfName) {
  var PF_EMAILS = {
    "Evan Anderson": "eanderson@vfo-services.com",
    "Bridger Silvester": "bsilvester@vfo-services.com",
    "Lindsay Morris": "lmorris@vfo-services.com"
  };
  return PF_EMAILS[pfName] || "";
}

// ============================================================
// C8.1 — EMAIL TO CLIENT (onEdit trigger from batch sheet)
// ============================================================

function onEditC8Email(e, targetSS) {
  if (e.authMode && e.authMode !== ScriptApp.AuthMode.FULL) return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (sheet.getRange("AB1").getValue() !== "Client Tracking") return;

  var C8_ROW = 26;
  var C8_COL = 7;
  if (row !== C8_ROW || col !== C8_COL) return;

  var val = String(e.value || "").trim();
  if (val !== "Send Declined Email" && val !== "Send Confirmation Email") return;
  var ss = (targetSS || e.source);

  var pfName = String(sheet.getRange("D20").getValue()).trim();
  if (!pfName) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Please enter PF name in D20 first", "Missing PF Name", 5);
    sheet.getRange(C8_ROW, C8_COL).clearContent();
    return;
  }

  var decision = "";
  var meetingDate = "N/A";

  if (val === "Send Declined Email") {
    decision = "Declined";
  } else {
    decision = "Confirmed";
    try {
      var ui = SpreadsheetApp.getUi();
      var response = ui.prompt(
        "Follow-Up Meeting Date",
        "Enter the PIP Follow-Up meeting date (e.g. 3/15/2026):",
        ui.ButtonSet.OK_CANCEL
      );
      if (response.getSelectedButton() !== ui.Button.OK) {
        sheet.getRange(C8_ROW, C8_COL).clearContent();
        return;
      }
      meetingDate = response.getResponseText().trim();
      if (!meetingDate) {
        SpreadsheetApp.getActiveSpreadsheet().toast("Meeting date is required", "Missing Date", 5);
        sheet.getRange(C8_ROW, C8_COL).clearContent();
        return;
      }
    } catch (err) {
      Logger.log("Could not show date prompt: " + err.message);
      sheet.getRange(C8_ROW, C8_COL).clearContent();
      return;
    }
  }

  var clientRef = sheet.getRange("A2").getValue();
  var clientFirst = sheet.getRange("B2").getValue();
  var clientLast = sheet.getRange("C2").getValue();
  var memberNum = sheet.getRange("A4").getValue();
  var memberFirst = sheet.getRange("B4").getValue();
  var memberLast = sheet.getRange("C4").getValue();

  var clientEmail = "";
  var memberEmail = "";
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    if (s.getName() === "Member Template") continue;
    try {
      if (String(s.getRange("BC1").getValue()).trim() === "Member") {
        memberEmail = s.getRange("E2").getValue() || "";
        var lastRow = s.getLastRow();
        if (lastRow >= 4) {
          var data = s.getRange(4, 1, lastRow - 3, 5).getValues();
          for (var r = 0; r < data.length; r++) {
            if (String(data[r][0]) === String(clientRef)) {
              clientEmail = data[r][4] || "";
              break;
            }
          }
        }
        break;
      }
    } catch (err) {}
  }

  // Write to Pipeline
  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) { Logger.log("Pipeline tab not found"); return; }

  var pipelineRow = findOrCreatePipelineRow(pipeline, {
    clientRef: clientRef,
    clientFirst: clientFirst,
    clientLast: clientLast,
    clientEmail: clientEmail,
    memberNum: memberNum,
    memberFirst: memberFirst,
    memberLast: memberLast,
    memberEmail: memberEmail,
    sourceSSID: ss.getId(),
    sourceSheetName: sheet.getName()
  });

  pipeline.getRange(pipelineRow, COL.C81_DECISION).setValue(decision);
  pipeline.getRange(pipelineRow, COL.C81_EMAIL_SENT).setValue("No");
  pipeline.getRange(pipelineRow, COL.FOLLOWUP_MEETING_DATE).setValue("'" + meetingDate);
  pipeline.getRange(pipelineRow, COL.PF).setValue(pfName);

  SpreadsheetApp.getActiveSpreadsheet().toast(decision + " email queued for " + clientFirst + " " + clientLast, "Success", 5);
  Logger.log("C8.1 " + decision + " email queued for: " + clientRef);
}

// ============================================================
// C13 — FORM LINK GENERATOR (onEdit trigger from batch sheet)
// ============================================================

function onEditGenerateC13FormLink(e, targetSS) {
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (sheet.getRange("AB1").getValue() !== "Client Tracking") return;

  var C13_ROW = 34;
  var C13_COL = 7;
  var LINK_COL = 9;
  if (row !== C13_ROW || col !== C13_COL) return;

  var val = e.value;
  if (!val || val === "") return;
  var ss = (targetSS || e.source);

  var clientRef = sheet.getRange("A2").getValue();
  var clientFirst = sheet.getRange("B2").getValue();
  var clientLast = sheet.getRange("C2").getValue();
  var memberNum = sheet.getRange("A4").getValue();
  var memberFirst = sheet.getRange("B4").getValue();
  var memberLast = sheet.getRange("C4").getValue();

  var clientEmail = "";
  var memberEmail = "";
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    if (s.getName() === "Member Template") continue;
    try {
      if (String(s.getRange("BC1").getValue()).trim() === "Member") {
        memberEmail = s.getRange("E2").getValue() || "";
        var lastRow = s.getLastRow();
        if (lastRow >= 4) {
          var data = s.getRange(4, 1, lastRow - 3, 5).getValues();
          for (var r = 0; r < data.length; r++) {
            if (String(data[r][0]) === String(clientRef)) {
              clientEmail = data[r][4] || "";
              break;
            }
          }
        }
        break;
      }
    } catch (err) {}
  }

  var params = [
    "clientRef=" + encodeURIComponent(clientRef),
    "clientFirst=" + encodeURIComponent(clientFirst),
    "clientLast=" + encodeURIComponent(clientLast),
    "clientEmail=" + encodeURIComponent(clientEmail),
    "memberNum=" + encodeURIComponent(memberNum),
    "memberFirst=" + encodeURIComponent(memberFirst),
    "memberLast=" + encodeURIComponent(memberLast),
    "memberEmail=" + encodeURIComponent(memberEmail),
    "ssId=" + encodeURIComponent(ss.getId()),
    "sheetName=" + encodeURIComponent(sheet.getName())
  ];
  var fullUrl = WEB_APP_URL + "?" + params.join("&");
  var linkFormula = '=HYPERLINK("' + fullUrl + '", "📋C13 Form")';
  sheet.getRange(C13_ROW, LINK_COL).setFormula(linkFormula);
  Logger.log("C13 form link generated for " + clientFirst + " " + clientLast);
}

// ============================================================
// C13 — FORM HTML
// ============================================================

function getC13FormHtml_() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #0a1628; color: #e2e8f0; min-height: 100vh; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .header h1 { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .header p { font-size: 13px; color: #64748b; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
    .info-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; }
    .info-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 4px; }
    .info-card .value { font-size: 14px; font-weight: 600; color: #f1f5f9; }
    .form-section { margin-bottom: 24px; }
    .form-section label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 8px; }
    select, input[type="text"], input[type="url"] { width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; -webkit-appearance: none; appearance: none; }
    select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer; }
    select:focus, input[type="text"]:focus, input[type="url"]:focus { border-color: #3b82f6; }
    select option { background: #1e293b; color: #f1f5f9; }
    .dollar-input { position: relative; }
    .dollar-input::before { content: "$"; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 14px; font-weight: 600; }
    .dollar-input input { padding-left: 28px; }
    .priority-container { margin-top: 8px; }
    .priority-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 20px; }
    .priority-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .priority-tag .remove { cursor: pointer; opacity: 0.6; font-size: 14px; line-height: 1; }
    .priority-tag .remove:hover { opacity: 1; }
    .pricing-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .pricing-section h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 16px; }
    .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pricing-grid .form-section { margin-bottom: 0; }
    .optional-label { font-size: 10px; color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .conditional-section { transition: all 0.3s ease; overflow: hidden; }
    .conditional-section.hidden { max-height: 0; opacity: 0; margin: 0; padding: 0; pointer-events: none; }
    .conditional-section.visible { max-height: 3000px; opacity: 1; }
    textarea { width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; resize: vertical; min-height: 120px; }
    textarea:focus { border-color: #3b82f6; }
    .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .submit-btn:hover { background: #1d4ed8; }
    .submit-btn:disabled { background: #1e3a5f; cursor: not-allowed; color: #64748b; }
    .success-message { text-align: center; padding: 60px 20px; }
    .success-message .check { width: 64px; height: 64px; background: rgba(34,197,94,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .success-message h2 { font-size: 20px; color: #fff; margin-bottom: 8px; }
    .success-message p { color: #64748b; font-size: 14px; }
    .priority-add-row { display: flex; gap: 8px; margin-top: 8px; }
    .priority-add-row select { flex: 1; }
    .priority-confirm-btn { padding: 10px 16px; background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; white-space: nowrap; }
    .priority-confirm-btn:hover { background: rgba(59,130,246,0.3); }
    .priority-add-row.hidden { display: none; }
    .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; cursor: pointer; }
    .checkbox-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; cursor: pointer; }
    .checkbox-row span { font-size: 13px; color: #94a3b8; font-weight: 400; }
    .membership-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .membership-row .membership-label { font-size: 14px; font-weight: 500; color: #e2e8f0; min-width: 50px; }
    .membership-row .dollar-input { flex: 1; }
    .membership-row .na-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; cursor: pointer; white-space: nowrap; }
    .membership-row .na-check input[type="checkbox"] { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
    .section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 28px 0; }
    .email-add-row { display: flex; gap: 8px; margin-top: 8px; }
    .email-add-row input { flex: 1; }
    .email-error { color: #ef4444; font-size: 11px; margin-top: 4px; display: none; }
  </style>
</head>
<body>

<div class="container" id="formContainer">

  <div class="header">
    <h1>C13 — Update PC re Outcome</h1>
    <p>Submit client outcome details for proactive coordinator</p>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="label">Client</div>
      <div class="value"><?= clientFirst ?> <?= clientLast ?></div>
    </div>
    <div class="info-card">
      <div class="label">Client Ref</div>
      <div class="value"><?= clientRef ?></div>
    </div>
    <div class="info-card">
      <div class="label">Member</div>
      <div class="value"><?= memberFirst ?> <?= memberLast ?></div>
    </div>
    <div class="info-card">
      <div class="label">Member #</div>
      <div class="value"><?= memberNum ?></div>
    </div>
  </div>

  <input type="hidden" id="clientRef" value="<?= clientRef ?>">
  <input type="hidden" id="clientFirst" value="<?= clientFirst ?>">
  <input type="hidden" id="clientLast" value="<?= clientLast ?>">
  <input type="hidden" id="clientEmail" value="<?= clientEmail ?>">
  <input type="hidden" id="memberNum" value="<?= memberNum ?>">
  <input type="hidden" id="memberFirst" value="<?= memberFirst ?>">
  <input type="hidden" id="memberLast" value="<?= memberLast ?>">
  <input type="hidden" id="memberEmail" value="<?= memberEmail ?>">
  <input type="hidden" id="ssId" value="<?= ssId ?>">
  <input type="hidden" id="sheetName" value="<?= sheetName ?>">

  <!-- Proactive Facilitator -->
  <div class="form-section">
    <label>Proactive Facilitator</label>
    <select id="proactiveFacilitator" onchange="checkFormValid()">
      <option value="">— Select —</option>
      <option value="Evan Anderson">Evan Anderson</option>
      <option value="Bridger Silvester">Bridger Silvester</option>
      <option value="Lindsay Morris">Lindsay Morris</option>
    </select>
  </div>

  <!-- Tax Planner -->
  <div class="form-section">
    <label>Tax Planner <span class="optional-label">(optional)</span></label>
    <select id="taxPlanner">
      <option value="">— None —</option>
      <option value="Tim Gacsy">Tim Gacsy</option>
    </select>
  </div>

  <!-- Client Decision -->
  <div class="form-section">
    <label>Client Decision</label>
    <select id="clientDecision" onchange="toggleSections()">
      <option value="">— Select —</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
      <option value="Undecided">Undecided</option>
    </select>
  </div>

  <!-- ========== UNDECIDED SECTIONS ========== -->
  <div class="conditional-section hidden" id="undecidedSection">

    <div class="form-section">
      <label>Reason for Being Undecided</label>
      <label class="checkbox-row">
        <input type="checkbox" id="reasonProcess" onchange="checkFormValid()">
        <span>Undecided whether to continue the process / unsure if would benefit from the service</span>
      </label>
      <label class="checkbox-row">
        <input type="checkbox" id="reasonService" onchange="checkFormValid()">
        <span>Undecided on which service level to choose</span>
      </label>
    </div>

    <hr class="section-divider">

    <div class="form-section">
      <label>Current Priorities</label>
      <div class="priority-container">
        <div class="priority-tags" id="currentTags"></div>
        <div class="priority-add-row" id="currentAddRow">
          <select id="currentSelect"><option value="">— Select Priority —</option></select>
          <button class="priority-confirm-btn" onclick="addPriority('current')">Add</button>
        </div>
      </div>
    </div>

    <div class="form-section">
      <label>Parked Priorities</label>
      <div class="priority-container">
        <div class="priority-tags" id="parkedTags"></div>
        <div class="priority-add-row" id="parkedAddRow">
          <select id="parkedSelect"><option value="">— Select Priority —</option></select>
          <button class="priority-confirm-btn" onclick="addPriority('parked')">Add</button>
        </div>
      </div>
    </div>

    <hr class="section-divider">

    <div class="pricing-section">
      <h3>Membership Options Outlined</h3>
      <div class="membership-row">
        <span class="membership-label">Lite</span>
        <div class="dollar-input">
          <input type="text" id="liteMembership" placeholder="0.00" oninput="checkFormValid()">
        </div>
      </div>
      <div class="membership-row">
        <span class="membership-label">Core</span>
        <div class="dollar-input">
          <input type="text" id="coreMembership" placeholder="0.00" oninput="checkFormValid()">
        </div>
      </div>
      <div class="membership-row">
        <span class="membership-label">Max</span>
        <div class="dollar-input">
          <input type="text" id="maxMembership" placeholder="0.00" oninput="checkFormValid()">
        </div>
        <label class="na-check">
          <input type="checkbox" id="maxNA" onchange="toggleMaxNA()">
          N/A
        </label>
      </div>
    </div>

  </div>

  <!-- ========== YES SECTIONS ========== -->
  <div class="conditional-section hidden" id="yesSection">

    <div class="form-section">
      <label>Current Priorities</label>
      <div class="priority-container">
        <div class="priority-tags" id="currentTagsYes"></div>
        <div class="priority-add-row">
          <select id="currentSelectYes"><option value="">— Select Priority —</option></select>
          <button class="priority-confirm-btn" onclick="addPriority('currentYes')">Add</button>
        </div>
      </div>
    </div>

    <div class="form-section">
      <label>Parked Priorities</label>
      <div class="priority-container">
        <div class="priority-tags" id="parkedTagsYes"></div>
        <div class="priority-add-row">
          <select id="parkedSelectYes"><option value="">— Select Priority —</option></select>
          <button class="priority-confirm-btn" onclick="addPriority('parkedYes')">Add</button>
        </div>
      </div>
    </div>

    <hr class="section-divider">

    <div class="form-section">
      <label>Client Service</label>
      <select id="clientService" onchange="toggleMaxMeeting(); checkFormValid()">
        <option value="">— Select —</option>
        <option value="Lite">Lite</option>
        <option value="Core">Core</option>
        <option value="Max">Max</option>
      </select>
    </div>

    <div class="pricing-section">
      <h3>Pricing</h3>
      <div class="form-section">
        <label>Gross Service Value</label>
        <div class="dollar-input">
          <input type="text" id="grossFee" placeholder="0.00" oninput="calcNet(); checkFormValid();">
        </div>
      </div>
      <div class="form-section">
        <label>Member Contribution <span class="optional-label">(if applicable)</span></label>
        <div class="dollar-input">
          <input type="text" id="memberContribution" placeholder="0.00" oninput="calcNet(); checkFormValid();">
        </div>
      </div>
      <div class="form-section">
        <label>Net Invoice Value</label>
        <div class="dollar-input">
          <input type="text" id="netInvoice" placeholder="0.00" readonly style="opacity: 0.7;">
        </div>
      </div>
    </div>

    <div class="pricing-section">
      <h3>Revenue Split</h3>
      <div class="pricing-grid">
        <div class="form-section">
          <label>Member Share</label>
          <div class="dollar-input">
            <input type="text" id="memberShare" placeholder="0.00" oninput="checkFormValid()">
          </div>
        </div>
        <div class="form-section">
          <label>VFOS Share</label>
          <div class="dollar-input">
            <input type="text" id="vfosShare" placeholder="0.00" oninput="checkFormValid()">
          </div>
        </div>
      </div>
    </div>

    <div class="conditional-section hidden" id="maxMeetingSection">
      <div class="form-section">
        <label>PIP Meeting Count (Max only)</label>
        <input type="text" id="pipMeetingCount" placeholder="Enter number of meetings" oninput="checkFormValid()">
      </div>
    </div>

    <div class="form-section">
      <label>Payment Plan</label>
      <select id="paymentPlan" onchange="checkFormValid()">
        <option value="">— Select —</option>
        <option value="Quarterly">Quarterly</option>
        <option value="1 Time Payment">1 Time Payment</option>
      </select>
    </div>

  </div>

  <!-- ========== ALWAYS VISIBLE ========== -->
  <div class="form-section">
    <label>Additional CC Recipients <span class="optional-label">(optional — these email addresses will be CC'd on all client emails)</span></label>
    <div class="priority-container">
      <div class="priority-tags" id="ccTags"></div>
      <div class="email-add-row">
        <input type="text" id="ccEmailInput" placeholder="Enter email address" onkeydown="if(event.key==='Enter'){event.preventDefault();addCcEmail();}">
        <button class="priority-confirm-btn" onclick="addCcEmail()">Add</button>
      </div>
      <div class="email-error" id="ccEmailError">Please enter a valid email address</div>
    </div>
  </div>

  <div class="form-section">
    <label>Meeting Notes</label>
    <textarea id="meetingNotes" placeholder="Enter any additional notes from the meeting..."></textarea>
  </div>

  <button class="submit-btn" id="submitBtn" onclick="submitForm()" disabled>Submit Outcome</button>

</div>

<div class="container" id="successContainer" style="display:none;">
  <div class="success-message">
    <div class="check">✓</div>
    <h2>Outcome Submitted</h2>
    <p>C13 data has been recorded. You can close this tab.</p>
  </div>
</div>

<script>

  var PRIORITIES = [
    "— Business Advisory —", "Business Growth", "Business Exit", "Business Advisory",
    "— Tax —", "Tax Planning (Income Tax Focus)", "Tax Planning (Capital Gain Tax Focus)", "Tax Planning (Retirement/Estate Tax Focus)", "Tax Planning (Charitable/Gift Tax Focus)", "Tax Planning (Business Tax Focus)", "Tax Planning",
    "— Risk Mitigation —", "Long Term Sickness Concern", "Living too Long Concern", "Death Impacting Dependents Concern", "Asset Protection (Personally Sued)", "Loss of Key Person", "Asset Protection (Business Sued)", "Technology Advancements", "Risk Mitigation",
    "— Wealth Planning —", "Wealth Planning (Short Term)", "Wealth Planning (Long Term)", "Wealth Planning (Short/Long Term)", "Wealth Planning (Grow Wealth)", "Wealth Planning (Retain Wealth)", "Wealth Planning (Grow/Retain Wealth)", "Wealth Planning (Young Kids Focus)", "Wealth Planning (College Planning Focus)", "Wealth Planning (Retirement Planning Focus)", "Wealth Planning (Legacy Planning Focus)", "Wealth Planning (Alternative Investments Focus)", "Wealth Planning",
    "— Legal —", "Family Law", "Trusts and Wills (Estate Planning)", "Contract / Corporate Law", "Structuring Entities", "Buy / Sell Agreements", "Joint Venture Agreements", "Intellectual Property", "Legal Focus"
  ];

  function populatePrioritySelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select Priority —</option>';
    PRIORITIES.forEach(function(p) {
      if (p.startsWith("—")) {
        var optgroup = document.createElement("optgroup");
        optgroup.label = p.replace(/—/g, "").trim();
        sel.appendChild(optgroup);
      } else {
        var opt = document.createElement("option");
        opt.value = p; opt.textContent = p;
        var groups = sel.querySelectorAll("optgroup");
        if (groups.length > 0) { groups[groups.length - 1].appendChild(opt); }
        else { sel.appendChild(opt); }
      }
    });
  }

  populatePrioritySelect("currentSelect");
  populatePrioritySelect("parkedSelect");
  populatePrioritySelect("currentSelectYes");
  populatePrioritySelect("parkedSelectYes");

  var priorityArrays = { current: [], parked: [], currentYes: [], parkedYes: [] };

  function addPriority(type) {
    var selId = type === "currentYes" ? "currentSelectYes" : type === "parkedYes" ? "parkedSelectYes" : type + "Select";
    var sel = document.getElementById(selId);
    var val = sel.value;
    if (!val) return;
    var arr = priorityArrays[type];
    if (arr.indexOf(val) > -1) return;
    arr.push(val);
    renderTags(type);
    sel.value = "";
    checkFormValid();
  }

  function removePriority(type, index) {
    priorityArrays[type].splice(index, 1);
    renderTags(type);
    checkFormValid();
  }

  function renderTags(type) {
    var arr = priorityArrays[type];
    var containerId = type + "Tags";
    if (type === "currentYes") containerId = "currentTagsYes";
    if (type === "parkedYes") containerId = "parkedTagsYes";
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    arr.forEach(function(p, i) {
      var tag = document.createElement("span");
      tag.className = "priority-tag";
      var rm = document.createElement("span");
      rm.className = "remove";
      rm.textContent = "×";
      rm.setAttribute("onclick", "removePriority('" + type + "'," + i + ")");
      tag.textContent = p + " ";
      tag.appendChild(rm);
      container.appendChild(tag);
    });
  }

  function toggleMaxMeeting() {
    var service = document.getElementById("clientService").value;
    var section = document.getElementById("maxMeetingSection");
    if (service === "Max") {
      section.classList.remove("hidden");
      section.classList.add("visible");
    } else {
      section.classList.remove("visible");
      section.classList.add("hidden");
      document.getElementById("pipMeetingCount").value = "";
    }
  }

  function toggleMaxNA() {
    var cb = document.getElementById("maxNA");
    var input = document.getElementById("maxMembership");
    if (cb.checked) {
      input.value = "N/A";
      input.disabled = true;
      input.style.opacity = "0.5";
    } else {
      input.value = "";
      input.disabled = false;
      input.style.opacity = "1";
    }
    checkFormValid();
  }

  function toggleSections() {
    var decision = document.getElementById("clientDecision").value;
    var undecidedSection = document.getElementById("undecidedSection");
    var yesSection = document.getElementById("yesSection");
    undecidedSection.classList.remove("visible"); undecidedSection.classList.add("hidden");
    yesSection.classList.remove("visible"); yesSection.classList.add("hidden");
    if (decision === "Undecided") { undecidedSection.classList.remove("hidden"); undecidedSection.classList.add("visible"); }
    else if (decision === "Yes") { yesSection.classList.remove("hidden"); yesSection.classList.add("visible"); }
    checkFormValid();
  }

  function checkFormValid() {
    var decision = document.getElementById("clientDecision").value;
    var pf = document.getElementById("proactiveFacilitator").value;
    var valid = false;
    if (!decision || !pf) { valid = false; }
    else if (decision === "No") { valid = true; }
    else if (decision === "Undecided") {
      var r1 = document.getElementById("reasonProcess").checked;
      var r2 = document.getElementById("reasonService").checked;
      var hasCurrent = priorityArrays.current.length > 0;
      var lite = document.getElementById("liteMembership").value.trim();
      var core = document.getElementById("coreMembership").value.trim();
      var maxNA = document.getElementById("maxNA").checked;
      var maxVal = maxNA || document.getElementById("maxMembership").value.trim();
      valid = (r1 || r2) && hasCurrent && lite && core && maxVal;
    } else if (decision === "Yes") {
      var gross = document.getElementById("grossFee").value.trim();
      var mShare = document.getElementById("memberShare").value.trim();
      var vShare = document.getElementById("vfosShare").value.trim();
      var service = document.getElementById("clientService").value;
      var plan = document.getElementById("paymentPlan").value;
      var hasCurrentYes = priorityArrays.currentYes.length > 0;
      valid = gross && mShare && vShare && service && plan && hasCurrentYes;
      if (service === "Max") {
        var pipCount = document.getElementById("pipMeetingCount").value.trim();
        valid = valid && pipCount;
      }
    }
    document.getElementById("submitBtn").disabled = !valid;
  }

  window.addEventListener('keydown', function(e) {
    e.stopPropagation();
  }, true);
  window.addEventListener('keyup', function(e) {
    e.stopPropagation();
  }, true);
  window.addEventListener('keypress', function(e) {
    e.stopPropagation();
  }, true);

  var ccEmails = [];

  function isValidEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  function addCcEmail() {
    var input = document.getElementById("ccEmailInput");
    var error = document.getElementById("ccEmailError");
    var val = input.value.trim();
    error.style.display = "none";
    if (!val) return;
    if (!isValidEmail(val)) {
      error.style.display = "block";
      return;
    }
    if (ccEmails.indexOf(val) > -1) {
      input.value = "";
      return;
    }
    ccEmails.push(val);
    renderCcTags();
    input.value = "";
  }

  function removeCcEmail(index) {
    ccEmails.splice(index, 1);
    renderCcTags();
  }

  function renderCcTags() {
    var container = document.getElementById("ccTags");
    container.innerHTML = "";
    ccEmails.forEach(function(email, i) {
      var tag = document.createElement("span");
      tag.className = "priority-tag";
      var rm = document.createElement("span");
      rm.className = "remove";
      rm.textContent = "×";
      rm.setAttribute("onclick", "removeCcEmail(" + i + ")");
      tag.textContent = email + " ";
      tag.appendChild(rm);
      container.appendChild(tag);
    });
  }

  function calcNet() {
    var gross = parseFloat(document.getElementById("grossFee").value) || 0;
    var contrib = parseFloat(document.getElementById("memberContribution").value) || 0;
    var net = gross - contrib;
    document.getElementById("netInvoice").value = net > 0 ? net.toFixed(2) : "0.00";
  }

  function submitForm() {
    var btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    var decision = document.getElementById("clientDecision").value;

    var curPriorities = [];
    var parPriorities = [];
    if (decision === "Undecided") { curPriorities = priorityArrays.current; parPriorities = priorityArrays.parked; }
    else if (decision === "Yes") { curPriorities = priorityArrays.currentYes; parPriorities = priorityArrays.parkedYes; }

    // Build undecided reason
    var r1 = document.getElementById("reasonProcess").checked;
    var r2 = document.getElementById("reasonService").checked;
    var undecidedReason = "N/A";
    if (decision === "Undecided") {
      if (r1 && r2) undecidedReason = "Both";
      else if (r1) undecidedReason = "Undecided whether to continue process";
      else if (r2) undecidedReason = "Undecided which service level to choose";
    }

    // Max membership: "N/A (not applicable)" if checkbox ticked, value otherwise
    var maxVal = "N/A";
    if (decision === "Undecided") {
      maxVal = document.getElementById("maxNA").checked ? "N/A (not applicable)" : document.getElementById("maxMembership").value.trim();
    }

    var formData = {
      clientRef: document.getElementById("clientRef").value,
      clientFirst: document.getElementById("clientFirst").value,
      clientLast: document.getElementById("clientLast").value,
      clientEmail: document.getElementById("clientEmail").value,
      memberNum: document.getElementById("memberNum").value,
      memberFirst: document.getElementById("memberFirst").value,
      memberLast: document.getElementById("memberLast").value,
      memberEmail: document.getElementById("memberEmail").value,
      proactiveFacilitator: document.getElementById("proactiveFacilitator").value,
      taxPlanner: document.getElementById("taxPlanner").value,
      clientDecision: decision,
      undecidedReason: undecidedReason,
      currentPriorities: (decision === "No") ? "N/A" : curPriorities.join(", ") || "N/A",
      parkedPriorities: (decision === "No") ? "N/A" : parPriorities.join(", ") || "N/A",
      liteMembership: decision === "Undecided" ? document.getElementById("liteMembership").value.trim() || "N/A" : "N/A",
      coreMembership: decision === "Undecided" ? document.getElementById("coreMembership").value.trim() || "N/A" : "N/A",
      maxMembership: maxVal,
      clientService: decision === "Yes" ? document.getElementById("clientService").value : "N/A",
      grossFee: decision === "Yes" ? document.getElementById("grossFee").value.trim() : "N/A",
      memberContribution: decision === "Yes" ? document.getElementById("memberContribution").value.trim() : "N/A",
      netInvoice: decision === "Yes" ? document.getElementById("netInvoice").value.trim() : "N/A",
      memberShare: decision === "Yes" ? document.getElementById("memberShare").value.trim() : "N/A",
      vfosShare: decision === "Yes" ? document.getElementById("vfosShare").value.trim() : "N/A",
     paymentPlan: decision === "Yes" ? document.getElementById("paymentPlan").value : "N/A",
      pipMeetingCount: (decision === "Yes" && document.getElementById("clientService").value === "Max") ? document.getElementById("pipMeetingCount").value.trim() : "N/A",
      extraCc: ccEmails.join(", "),
      meetingNotes: document.getElementById("meetingNotes").value,
      ssId: document.getElementById("ssId").value,
      sheetName: document.getElementById("sheetName").value
    };

    var scriptUrl = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
    var params = Object.keys(formData).map(function(key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(formData[key]);
    }).join("&");

    google.script.run
      .withSuccessHandler(function() {
        document.getElementById("formContainer").style.display = "none";
        document.getElementById("successContainer").style.display = "block";
      })
      .withFailureHandler(function(err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Submit Outcome";
      })
      .processC13Form(formData);
  }

</script>
</body>
</html>`;
}

// ============================================================
// C13 — FORM HANDLER (creates/updates Pipeline row)
// ============================================================

function processC13Form(formData) {
  Logger.log("processC13Form called — clientRef: " + (formData.clientRef || "EMPTY"));
  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) { Logger.log("Pipeline tab not found"); return; }
  Logger.log("Pipeline tab found, last row: " + pipeline.getLastRow());

  var decision = formData.clientDecision || "";

  // Auto-set PIP Meeting Count based on service level
  var pipMeetingCount = "N/A";
  if (decision === "Yes") {
    var svc = formData.clientService || "";
    if (svc === "Lite") pipMeetingCount = "1";
    else if (svc === "Core") pipMeetingCount = "4";
    else if (svc === "Max") pipMeetingCount = formData.pipMeetingCount || "N/A";
  }

  // Find or create row
  var pipelineRow = findOrCreatePipelineRow(pipeline, {
    clientRef: formData.clientRef || "",
    clientFirst: formData.clientFirst || "",
    clientLast: formData.clientLast || "",
    clientEmail: formData.clientEmail || "",
    memberNum: formData.memberNum || "",
    memberFirst: formData.memberFirst || "",
    memberLast: formData.memberLast || "",
    memberEmail: formData.memberEmail || "",
    sourceSSID: formData.ssId || "",
    sourceSheetName: formData.sheetName || ""
  });

  // Assignment
  pipeline.getRange(pipelineRow, COL.PF).setValue(formData.proactiveFacilitator || "");
  pipeline.getRange(pipelineRow, COL.TAX_PLANNER).setValue(formData.taxPlanner || "");

  // C13 Decision
  pipeline.getRange(pipelineRow, COL.C13_DECISION).setValue(decision);

  // Priorities & Notes (all paths except No)
  pipeline.getRange(pipelineRow, COL.CURRENT_PRIORITIES).setValue(
    (decision === "No") ? "N/A" : (formData.currentPriorities || "N/A")
  );
  pipeline.getRange(pipelineRow, COL.PARKED_PRIORITIES).setValue(
    (decision === "No") ? "N/A" : (formData.parkedPriorities || "N/A")
  );
  pipeline.getRange(pipelineRow, COL.MEETING_NOTES).setValue(formData.meetingNotes || "");
  pipeline.getRange(pipelineRow, COL.EXTRA_CC).setValue(formData.extraCc || "");

  // Undecided path
  if (decision === "Undecided") {
    pipeline.getRange(pipelineRow, COL.UNDECIDED_REASON).setValue(formData.undecidedReason || "N/A");
    pipeline.getRange(pipelineRow, COL.LITE_MEMBERSHIP).setValue(formData.liteMembership || "N/A");
    pipeline.getRange(pipelineRow, COL.CORE_MEMBERSHIP).setValue(formData.coreMembership || "N/A");
    pipeline.getRange(pipelineRow, COL.MAX_MEMBERSHIP).setValue(formData.maxMembership || "N/A");
    pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("No");
  }

  // No path
  if (decision === "No") {
    pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("No");
  }

  // Yes path
  if (decision === "Yes") {
    pipeline.getRange(pipelineRow, COL.SERVICE_LEVEL).setValue(formData.clientService || "N/A");
    pipeline.getRange(pipelineRow, COL.PIP_MEETING_COUNT).setValue(pipMeetingCount);
    pipeline.getRange(pipelineRow, COL.GROSS_FEE).setValue(formData.grossFee || "N/A");
    pipeline.getRange(pipelineRow, COL.MEMBER_CONTRIBUTION).setValue(formData.memberContribution || "N/A");
    pipeline.getRange(pipelineRow, COL.NET_INVOICE).setValue(formData.netInvoice || "N/A");
    pipeline.getRange(pipelineRow, COL.MEMBER_SHARE).setValue(formData.memberShare || "N/A");
    pipeline.getRange(pipelineRow, COL.VFOS_SHARE).setValue(formData.vfosShare || "N/A");
    pipeline.getRange(pipelineRow, COL.PAYMENT_PLAN).setValue(formData.paymentPlan || "N/A");
    pipeline.getRange(pipelineRow, COL.C16_SENT).setValue("No");
  }

  Logger.log("C13 Outcome recorded for: " + formData.clientRef + " | Decision: " + decision);
  return "Success";
}
// ============================================================
// C15 — CLIENT DECISION HANDLER (web form from C14 email buttons)
// ============================================================

function handleC15Decision(params) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return getC15ResponseHtml_("already_submitted", params.decision || "");
  }

  try {
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return ContentService.createTextOutput("Error");

    var clientRef = params.clientRef || "";
    var decision = params.decision || "";
    var serviceLevel = params.serviceLevel || "N/A";
    var emailSentTimestamp = params.sent || "";
    var token = params.token || "";

    // Check 14-day expiry
    if (emailSentTimestamp) {
      try {
        var sentDate = new Date(decodeURIComponent(emailSentTimestamp));
        var now = new Date();
        var diffDays = (now - sentDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 14) {
          return getC15ResponseHtml_("expired", decision);
        }
      } catch (err) {
        Logger.log("Could not parse sent timestamp: " + emailSentTimestamp);
      }
    }

    // Find pipeline row
    var pipelineRow = findPipelineRow(pipeline, clientRef);
    if (pipelineRow === 0) {
      return getC15ResponseHtml_("already_submitted", decision);
    }

    // Verify token
    var storedToken = String(pipeline.getRange(pipelineRow, COL.C15_TOKEN).getValue()).trim();
    if (!token || token !== storedToken) {
      Logger.log("C15: Invalid token for " + clientRef + " — received: " + token + " expected: " + storedToken);
      return getC15ResponseHtml_("already_submitted", decision);
    }

    // Check for duplicate submission
    var existingDecision = String(pipeline.getRange(pipelineRow, COL.C15_FINAL_DECISION).getValue()).trim();
    if (existingDecision === "Yes" || existingDecision === "No" || existingDecision === "Extra Meeting") {
      return getC15ResponseHtml_("already_submitted", decision);
    }

    // Write C15 decision
    pipeline.getRange(pipelineRow, COL.C15_FINAL_DECISION).setValue(decision);
    pipeline.getRange(pipelineRow, COL.C15_SERVICE_LEVEL).setValue(serviceLevel);
    SpreadsheetApp.flush();

    var sourceSSID = String(pipeline.getRange(pipelineRow, COL.SOURCE_SS_ID).getValue()).trim();

    // Update Client Tracking G38 (skip for ExtraMeeting — no decision yet)
    if (sourceSSID && decision !== "ExtraMeeting") {
      try {
        var sourceSS = SpreadsheetApp.openById(sourceSSID);
        var allSheets = sourceSS.getSheets();
        for (var s = 0; s < allSheets.length; s++) {
          var sht = allSheets[s];
          try {
            if (String(sht.getRange("AB1").getValue()).trim() === "Client Tracking" &&
                String(sht.getRange("A2").getValue()).trim() === String(clientRef).trim()) {
              sht.getRange("G38").setValue(decision === "Yes" ? "Yes" : "No");
              sht.getRange("H38").setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/dd/yyyy"));
              Logger.log("C15: G38=" + decision + " for " + clientRef);

              if (decision === "Yes") {
                var fakeEvent = {
                  range: sht.getRange("G38"),
                  value: "Yes",
                  source: sourceSS
                };
                onEditAddToVFOSClientMoneyAccountsN8N(fakeEvent);
                Logger.log("Triggered n8n push for G38 in " + sht.getName());
              }
              break;
            }
          } catch (err) {}
        }
      } catch (err) {
        Logger.log("Could not update Client Tracking: " + err.message);
      }
    }

    // If No: set C14 Email Sent back to "No" so C14 sends the decline email
    if (decision === "No") {
      pipeline.getRange(pipelineRow, COL.C13_DECISION).setValue("No");
      pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("No");
      Logger.log("C15: Undecided→No for " + clientRef + ", C14 re-queued");
    }

    // If Yes: flag for PF pricing form
    if (decision === "Yes") {
      pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("PF Pricing Needed");
      Logger.log("C15: Undecided→Yes for " + clientRef + ", PF Pricing flagged");
    }

    // If ExtraMeeting: invalidate token, flag for Master to pick up
    if (decision === "ExtraMeeting") {
      pipeline.getRange(pipelineRow, COL.C15_FINAL_DECISION).setValue("Extra Meeting");
      pipeline.getRange(pipelineRow, COL.C15_TOKEN).setValue("");
      pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("Extra Meeting PF Needed");

      Logger.log("C15: ExtraMeeting for " + clientRef + ", token cleared, PF email flagged");
      return getC15ResponseHtml_("extra_meeting", decision);
    }

    Logger.log("C15 Decision: " + clientRef + " = " + decision + " (" + serviceLevel + ")");
    return getC15ResponseHtml_("success", decision);

  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// C15 — RESPONSE HTML (shown to client after clicking button)
// ============================================================

function getC15ResponseHtml_(status, decision) {
  var title, message, icon, color;
  if (status === "expired") {
    title = "Link Expired";
    message = "This decision link has expired as more than 14 days have passed since it was sent. Please contact your Proactive Facilitator if you would still like to proceed.";
    icon = "⏰"; color = "#f59e0b";
  } else if (status === "already_submitted") {
    title = "Already Received";
    message = "We've already received your decision — no further action is needed. Thank you!";
    icon = "ℹ️"; color = "#3b82f6";
  } else if (status === "extra_meeting") {
    title = "Meeting Requested";
    message = "Thank you — your Proactive Facilitator will be in touch to arrange an additional meeting.";
    icon = "📅"; color = "#2563eb";
  } else if (decision === "Yes") {
    title = "Thank You!";
    message = "We're excited to move forward with you!";
    icon = "✓"; color = "#22c55e";
  } else {
    title = "Thank You";
    message = "We appreciate you letting us know. If circumstances ever change, we'll be right here to help.";
    icon = "✓"; color = "#22c55e";
  }
  return HtmlService.createHtmlOutput('<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + '* { margin: 0; padding: 0; box-sizing: border-box; }'
    + 'body { font-family: "DM Sans", sans-serif; background: #0a1628; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }'
    + '.card { text-align: center; max-width: 480px; padding: 48px 32px; }'
    + '.icon { width: 72px; height: 72px; background: ' + color + '20; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; }'
    + 'h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 12px; }'
    + 'p { font-size: 15px; color: #94a3b8; line-height: 1.6; }'
    + '</style></head><body>'
    + '<div class="card"><div class="icon">' + icon + '</div>'
    + '<h1>' + title + '</h1><p>' + message + '</p></div></body></html>')
    .setTitle("VFO Services")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ============================================================
// EXTRA MEETING FORM HTML
// ============================================================

function getC15ExtraMeetingFormHtml_() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #0a1628; color: #e2e8f0; min-height: 100vh; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .header h1 { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .header p { font-size: 13px; color: #64748b; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
    .info-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; }
    .info-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 4px; }
    .info-card .value { font-size: 14px; font-weight: 600; color: #f1f5f9; }
    .form-section { margin-bottom: 24px; }
    .form-section label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 8px; }
    select, input[type="text"] { width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; -webkit-appearance: none; appearance: none; }
    select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer; }
    select:focus, input[type="text"]:focus { border-color: #3b82f6; }
    select option { background: #1e293b; color: #f1f5f9; }
    .dollar-input { position: relative; }
    .dollar-input::before { content: "$"; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 14px; font-weight: 600; }
    .dollar-input input { padding-left: 28px; }
    .pricing-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .pricing-section h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 16px; }
    .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pricing-grid .form-section { margin-bottom: 0; }
    .optional-label { font-size: 10px; color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .conditional-section { transition: all 0.3s ease; overflow: hidden; }
    .conditional-section.hidden { max-height: 0; opacity: 0; margin: 0; padding: 0; pointer-events: none; }
    .conditional-section.visible { max-height: 1000px; opacity: 1; }
    .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .submit-btn:hover { background: #1d4ed8; }
    .submit-btn:disabled { background: #1e3a5f; cursor: not-allowed; color: #64748b; }
    .success-message { text-align: center; padding: 60px 20px; }
    .success-message .check { width: 64px; height: 64px; background: rgba(34,197,94,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .success-message h2 { font-size: 20px; color: #fff; margin-bottom: 8px; }
    .success-message p { color: #64748b; font-size: 14px; }
    .section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 28px 0; }
  </style>
</head>
<body>
<div class="container" id="formContainer">
  <div class="header">
    <h1>C15 — Extra Meeting Decision</h1>
    <p>Client requested an additional meeting — please confirm their decision</p>
  </div>
  <div class="info-grid">
    <div class="info-card">
      <div class="label">Client</div>
      <div class="value"><?= clientFirst ?> <?= clientLast ?></div>
    </div>
    <div class="info-card">
      <div class="label">Client Ref</div>
      <div class="value"><?= clientRef ?></div>
    </div>
    <div class="info-card">
      <div class="label">Member</div>
      <div class="value"><?= memberFirst ?> <?= memberLast ?></div>
    </div>
  </div>
  <input type="hidden" id="clientRef" value="<?= clientRef ?>">
  <input type="hidden" id="clientFirst" value="<?= clientFirst ?>">
  <input type="hidden" id="clientLast" value="<?= clientLast ?>">
  <input type="hidden" id="memberFirst" value="<?= memberFirst ?>">
  <input type="hidden" id="memberLast" value="<?= memberLast ?>">

  <div class="form-section">
    <label>Client Decision After Meeting</label>
    <select id="meetingDecision" onchange="toggleYesSection(); checkFormValid();">
      <option value="">— Select —</option>
      <option value="Yes">Yes — Moving Forward</option>
      <option value="No">No — Not Moving Forward</option>
    </select>
  </div>

  <div class="conditional-section hidden" id="yesSection">

    <div class="form-section">
      <label>Service Level</label>
      <select id="serviceLevel" onchange="toggleMaxMeeting(); checkFormValid();">
        <option value="">— Select —</option>
        <option value="Lite">Lite</option>
        <option value="Core">Core</option>
        <option value="Max">Max</option>
      </select>
    </div>

    <div class="pricing-section">
      <h3>Pricing</h3>
      <div class="form-section">
        <label>Gross Service Value</label>
        <div class="dollar-input">
          <input type="text" id="grossFee" placeholder="0.00" oninput="calcNet(); checkFormValid();">
        </div>
      </div>
      <div class="form-section">
        <label>Member Contribution <span class="optional-label">(if applicable)</span></label>
        <div class="dollar-input">
          <input type="text" id="memberContribution" placeholder="0.00" oninput="calcNet(); checkFormValid();">
        </div>
      </div>
      <div class="form-section">
        <label>Net Invoice Value</label>
        <div class="dollar-input">
          <input type="text" id="netInvoice" placeholder="0.00" readonly style="opacity: 0.7;">
        </div>
      </div>
    </div>

    <div class="pricing-section">
      <h3>Revenue Split</h3>
      <div class="pricing-grid">
        <div class="form-section">
          <label>Member Share</label>
          <div class="dollar-input">
            <input type="text" id="memberShare" placeholder="0.00" oninput="checkFormValid()">
          </div>
        </div>
        <div class="form-section">
          <label>VFOS Share</label>
          <div class="dollar-input">
            <input type="text" id="vfosShare" placeholder="0.00" oninput="checkFormValid()">
          </div>
        </div>
      </div>
    </div>

    <div class="conditional-section hidden" id="maxMeetingSection">
      <div class="form-section">
        <label>PIP Meeting Count (Max only)</label>
        <input type="text" id="pipMeetingCount" placeholder="Enter number of meetings" oninput="checkFormValid()">
      </div>
    </div>

    <div class="form-section">
      <label>Payment Plan</label>
      <select id="paymentPlan" onchange="checkFormValid()">
        <option value="">— Select —</option>
        <option value="Quarterly">Quarterly</option>
        <option value="1 Time Payment">1 Time Payment</option>
      </select>
    </div>

  </div>

  <button class="submit-btn" id="submitBtn" onclick="submitForm()" disabled>Submit Decision</button>
</div>

<div class="container" id="successContainer" style="display:none;">
  <div class="success-message">
    <div class="check">&#10003;</div>
    <h2>Decision Submitted</h2>
    <p id="successText">The decision has been recorded and the pipeline will continue automatically. You can close this tab.</p>
  </div>
</div>

<script>
  function toggleYesSection() {
    var decision = document.getElementById("meetingDecision").value;
    var yesSection = document.getElementById("yesSection");
    if (decision === "Yes") {
      yesSection.classList.remove("hidden");
      yesSection.classList.add("visible");
    } else {
      yesSection.classList.remove("visible");
      yesSection.classList.add("hidden");
    }
  }

  function toggleMaxMeeting() {
    var service = document.getElementById("serviceLevel").value;
    var section = document.getElementById("maxMeetingSection");
    if (service === "Max") {
      section.classList.remove("hidden");
      section.classList.add("visible");
    } else {
      section.classList.remove("visible");
      section.classList.add("hidden");
      document.getElementById("pipMeetingCount").value = "";
    }
  }

  function calcNet() {
    var gross = parseFloat(document.getElementById("grossFee").value) || 0;
    var contrib = parseFloat(document.getElementById("memberContribution").value) || 0;
    var net = gross - contrib;
    document.getElementById("netInvoice").value = net > 0 ? net.toFixed(2) : "0.00";
  }

  function checkFormValid() {
    var decision = document.getElementById("meetingDecision").value;
    var valid = false;
    if (decision === "No") {
      valid = true;
    } else if (decision === "Yes") {
      var svc = document.getElementById("serviceLevel").value;
      var gross = document.getElementById("grossFee").value.trim();
      var mShare = document.getElementById("memberShare").value.trim();
      var vShare = document.getElementById("vfosShare").value.trim();
      var plan = document.getElementById("paymentPlan").value;
      valid = svc && gross && mShare && vShare && plan;
      if (svc === "Max") {
        var pipCount = document.getElementById("pipMeetingCount").value.trim();
        valid = valid && pipCount;
      }
    }
    document.getElementById("submitBtn").disabled = !valid;
  }

  function submitForm() {
    var btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    var decision = document.getElementById("meetingDecision").value;
    var svc = decision === "Yes" ? document.getElementById("serviceLevel").value : "";
    var pipMeetingCount = "N/A";
    if (svc === "Lite") pipMeetingCount = "1";
    else if (svc === "Core") pipMeetingCount = "4";
    else if (svc === "Max") pipMeetingCount = document.getElementById("pipMeetingCount").value.trim() || "N/A";

    var formData = {
      action: "c15extrameetingsubmit",
      clientRef: document.getElementById("clientRef").value,
      decision: decision,
      serviceLevel: svc,
      grossFee: decision === "Yes" ? document.getElementById("grossFee").value.trim() : "",
      memberContribution: decision === "Yes" ? document.getElementById("memberContribution").value.trim() || "0" : "",
      netInvoice: decision === "Yes" ? document.getElementById("netInvoice").value.trim() : "",
      memberShare: decision === "Yes" ? document.getElementById("memberShare").value.trim() : "",
      vfosShare: decision === "Yes" ? document.getElementById("vfosShare").value.trim() : "",
      paymentPlan: decision === "Yes" ? document.getElementById("paymentPlan").value : "",
      pipMeetingCount: pipMeetingCount
    };

    var scriptUrl = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
    var params = Object.keys(formData).map(function(key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(formData[key]);
    }).join("&");

    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = scriptUrl + "?" + params;
    document.body.appendChild(iframe);
    iframe.onload = function() {
      document.getElementById("formContainer").style.display = "none";
      document.getElementById("successContainer").style.display = "block";
      if (decision === "No") {
        document.getElementById("successText").textContent = "The client's decision has been recorded. A decline email will be sent to the client.";
      }
    };
  }
</script>
</body>
</html>`;
}

function handleC15ExtraMeetingForm(params) {
  var clientRef = params.clientRef || "";
  var decision = params.decision || "";
  if (!clientRef) { Logger.log("C15ExtraMeeting: no clientRef"); return ContentService.createTextOutput("Error: no clientRef"); }

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return ContentService.createTextOutput("Error: sheet not found");

  var pipelineRow = findPipelineRow(pipeline, clientRef);
  if (pipelineRow === 0) return ContentService.createTextOutput("Error: client not found");

  if (decision === "Yes") {
    var svc = params.serviceLevel || "";
    var pipMeetingCount = "N/A";
    if (svc === "Lite") pipMeetingCount = "1";
    else if (svc === "Core") pipMeetingCount = "4";
    else if (svc === "Max") pipMeetingCount = params.pipMeetingCount || "N/A";

    pipeline.getRange(pipelineRow, COL.C15_FINAL_DECISION).setValue("Yes");
    pipeline.getRange(pipelineRow, COL.SERVICE_LEVEL).setValue(svc);
    pipeline.getRange(pipelineRow, COL.PIP_MEETING_COUNT).setValue(pipMeetingCount);
    pipeline.getRange(pipelineRow, COL.GROSS_FEE).setValue(params.grossFee || "N/A");
    pipeline.getRange(pipelineRow, COL.MEMBER_CONTRIBUTION).setValue(params.memberContribution || "0");
    pipeline.getRange(pipelineRow, COL.NET_INVOICE).setValue(params.netInvoice || "N/A");
    pipeline.getRange(pipelineRow, COL.MEMBER_SHARE).setValue(params.memberShare || "N/A");
    pipeline.getRange(pipelineRow, COL.VFOS_SHARE).setValue(params.vfosShare || "N/A");
    pipeline.getRange(pipelineRow, COL.PAYMENT_PLAN).setValue(params.paymentPlan || "N/A");
    pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("Yes");
    pipeline.getRange(pipelineRow, COL.C16_SENT).setValue("No");

    Logger.log("C15ExtraMeeting: Yes for " + clientRef + " | svc=" + svc + " | gross=" + params.grossFee + " | plan=" + params.paymentPlan);
  }

  if (decision === "No") {
    pipeline.getRange(pipelineRow, COL.C15_FINAL_DECISION).setValue("No");
    pipeline.getRange(pipelineRow, COL.C13_DECISION).setValue("No");
    pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("No");

    Logger.log("C15ExtraMeeting: No for " + clientRef + ", decline email queued");
  }

  return ContentService.createTextOutput("OK");
}

// ============================================================
// C15 YES — PF PRICING FORM HTML
// ============================================================

function getC15YesFormHtml_() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #0a1628; color: #e2e8f0; min-height: 100vh; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .header h1 { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .header p { font-size: 13px; color: #64748b; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
    .info-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; }
    .info-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 4px; }
    .info-card .value { font-size: 14px; font-weight: 600; color: #f1f5f9; }
    .form-section { margin-bottom: 24px; }
    .form-section label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 8px; }
    select, input[type="text"] { width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; -webkit-appearance: none; appearance: none; }
    select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer; }
    select:focus, input[type="text"]:focus { border-color: #3b82f6; }
    select option { background: #1e293b; color: #f1f5f9; }
    .dollar-input { position: relative; }
    .dollar-input::before { content: "$"; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 14px; font-weight: 600; }
    .dollar-input input { padding-left: 28px; }
    .pricing-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .pricing-section h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 16px; }
    .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pricing-grid .form-section { margin-bottom: 0; }
    .optional-label { font-size: 10px; color: #475569; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .conditional-section { transition: all 0.3s ease; overflow: hidden; }
    .conditional-section.hidden { max-height: 0; opacity: 0; margin: 0; padding: 0; pointer-events: none; }
    .conditional-section.visible { max-height: 1000px; opacity: 1; }
    .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    .submit-btn:hover { background: #1d4ed8; }
    .submit-btn:disabled { background: #1e3a5f; cursor: not-allowed; color: #64748b; }
    .success-message { text-align: center; padding: 60px 20px; }
    .success-message .check { width: 64px; height: 64px; background: rgba(34,197,94,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .success-message h2 { font-size: 20px; color: #fff; margin-bottom: 8px; }
    .success-message p { color: #64748b; font-size: 14px; }
    .section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 28px 0; }
  </style>
</head>
<body>
<div class="container" id="formContainer">
  <div class="header">
    <h1>C15Yes — Complete Pricing Details</h1>
    <p>Client has confirmed YES — please fill in the pricing and payment details</p>
  </div>
  <div class="info-grid">
    <div class="info-card">
      <div class="label">Client</div>
      <div class="value"><?= clientFirst ?> <?= clientLast ?></div>
    </div>
    <div class="info-card">
      <div class="label">Client Ref</div>
      <div class="value"><?= clientRef ?></div>
    </div>
    <div class="info-card">
      <div class="label">Service Level</div>
      <div class="value"><?= serviceLevel ?></div>
    </div>
    <div class="info-card">
      <div class="label">Member</div>
      <div class="value"><?= memberFirst ?> <?= memberLast ?></div>
    </div>
  </div>
  <input type="hidden" id="clientRef" value="<?= clientRef ?>">
  <input type="hidden" id="serviceLevel" value="<?= serviceLevel ?>">
  <div class="pricing-section">
    <h3>Pricing</h3>
    <div class="form-section">
      <label>Gross Service Value</label>
      <div class="dollar-input">
        <input type="text" id="grossFee" placeholder="0.00" oninput="calcNet(); checkFormValid();">
      </div>
    </div>
    <div class="form-section">
      <label>Member Contribution <span class="optional-label">(if applicable)</span></label>
      <div class="dollar-input">
        <input type="text" id="memberContribution" placeholder="0.00" oninput="calcNet(); checkFormValid();">
      </div>
    </div>
    <div class="form-section">
      <label>Net Invoice Value</label>
      <div class="dollar-input">
        <input type="text" id="netInvoice" placeholder="0.00" readonly style="opacity: 0.7;">
      </div>
    </div>
  </div>
  <div class="pricing-section">
    <h3>Revenue Split</h3>
    <div class="pricing-grid">
      <div class="form-section">
        <label>Member Share</label>
        <div class="dollar-input">
          <input type="text" id="memberShare" placeholder="0.00" oninput="checkFormValid()">
        </div>
      </div>
      <div class="form-section">
        <label>VFOS Share</label>
        <div class="dollar-input">
          <input type="text" id="vfosShare" placeholder="0.00" oninput="checkFormValid()">
        </div>
      </div>
    </div>
  </div>
  <div class="conditional-section <?= serviceLevel === 'Max' ? 'visible' : 'hidden' ?>" id="maxMeetingSection">
    <div class="form-section">
      <label>PIP Meeting Count (Max only)</label>
      <input type="text" id="pipMeetingCount" placeholder="Enter number of meetings" oninput="checkFormValid()">
    </div>
  </div>
  <div class="form-section">
    <label>Payment Plan</label>
    <select id="paymentPlan" onchange="checkFormValid()">
      <option value="">— Select —</option>
      <option value="Quarterly">Quarterly</option>
      <option value="1 Time Payment">1 Time Payment</option>
    </select>
  </div>
  <button class="submit-btn" id="submitBtn" onclick="submitForm()" disabled>Submit Details</button>
</div>
<div class="container" id="successContainer" style="display:none;">
  <div class="success-message">
    <div class="check">&#10003;</div>
    <h2>Details Submitted</h2>
    <p>Pricing details have been recorded. The engagement letter will be generated automatically. You can close this tab.</p>
  </div>
</div>
<script>
  function checkFormValid() {
    var gross = document.getElementById("grossFee").value.trim();
    var mShare = document.getElementById("memberShare").value.trim();
    var vShare = document.getElementById("vfosShare").value.trim();
    var plan = document.getElementById("paymentPlan").value;
    var valid = gross && mShare && vShare && plan;
    var svc = document.getElementById("serviceLevel").value;
    if (svc === "Max") {
      var pipCount = document.getElementById("pipMeetingCount").value.trim();
      valid = valid && pipCount;
    }
    document.getElementById("submitBtn").disabled = !valid;
  }
  function calcNet() {
    var gross = parseFloat(document.getElementById("grossFee").value) || 0;
    var contrib = parseFloat(document.getElementById("memberContribution").value) || 0;
    var net = gross - contrib;
    document.getElementById("netInvoice").value = net > 0 ? net.toFixed(2) : "0.00";
  }
  function submitForm() {
    var btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";
    var svc = document.getElementById("serviceLevel").value;
    var pipMeetingCount = "N/A";
    if (svc === "Lite") pipMeetingCount = "1";
    else if (svc === "Core") pipMeetingCount = "4";
    else if (svc === "Max") pipMeetingCount = document.getElementById("pipMeetingCount").value.trim() || "N/A";
    var formData = {
      action: "c15yes",
      clientRef: document.getElementById("clientRef").value,
      serviceLevel: svc,
      grossFee: document.getElementById("grossFee").value.trim(),
      memberContribution: document.getElementById("memberContribution").value.trim() || "0",
      netInvoice: document.getElementById("netInvoice").value.trim(),
      memberShare: document.getElementById("memberShare").value.trim(),
      vfosShare: document.getElementById("vfosShare").value.trim(),
      paymentPlan: document.getElementById("paymentPlan").value,
      pipMeetingCount: pipMeetingCount
    };
    var scriptUrl = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
    var params = Object.keys(formData).map(function(key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(formData[key]);
    }).join("&");
    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = scriptUrl + "?" + params;
    document.body.appendChild(iframe);
    iframe.onload = function() {
      document.getElementById("formContainer").style.display = "none";
      document.getElementById("successContainer").style.display = "block";
    };
  }
</script>
</body>
</html>`;
}

// ============================================================
// C15 YES — PF PRICING FORM HANDLER
// ============================================================

function handleC15YesForm(params) {
  var clientRef = params.clientRef || "";
  if (!clientRef) { Logger.log("C15Yes: no clientRef"); return ContentService.createTextOutput("Error: no clientRef"); }

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return ContentService.createTextOutput("Error: sheet not found");

  var pipelineRow = findPipelineRow(pipeline, clientRef);
  if (pipelineRow === 0) return ContentService.createTextOutput("Error: client not found");

  var svc = params.serviceLevel || "";
  var pipMeetingCount = "N/A";
  if (svc === "Lite") pipMeetingCount = "1";
  else if (svc === "Core") pipMeetingCount = "4";
  else if (svc === "Max") pipMeetingCount = params.pipMeetingCount || "N/A";

  pipeline.getRange(pipelineRow, COL.SERVICE_LEVEL).setValue(svc);
  pipeline.getRange(pipelineRow, COL.PIP_MEETING_COUNT).setValue(pipMeetingCount);
  pipeline.getRange(pipelineRow, COL.GROSS_FEE).setValue(params.grossFee || "N/A");
  pipeline.getRange(pipelineRow, COL.MEMBER_CONTRIBUTION).setValue(params.memberContribution || "0");
  pipeline.getRange(pipelineRow, COL.NET_INVOICE).setValue(params.netInvoice || "N/A");
  pipeline.getRange(pipelineRow, COL.MEMBER_SHARE).setValue(params.memberShare || "N/A");
  pipeline.getRange(pipelineRow, COL.VFOS_SHARE).setValue(params.vfosShare || "N/A");
  pipeline.getRange(pipelineRow, COL.PAYMENT_PLAN).setValue(params.paymentPlan || "N/A");
  pipeline.getRange(pipelineRow, COL.C14_EMAIL_SENT).setValue("Yes");
  pipeline.getRange(pipelineRow, COL.C16_SENT).setValue("No");

  Logger.log("C15Yes: Updated pricing for " + clientRef + " | gross=" + params.grossFee + " plan=" + params.paymentPlan);
  return ContentService.createTextOutput("OK");
}


// ============================================================
// Failed Payment Form
// ============================================================

function stripeRequest(endpoint, params) {
  var url = "https://api.stripe.com/v1/" + endpoint;
  var options = {
    method: "post",
    headers: {
      "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":")
    },
    payload: params,
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  Logger.log("Stripe " + endpoint + " status: " + code);
  if (code !== 200) {
    Logger.log("Stripe error: " + body);
    return null;
  }
  return JSON.parse(body);
}

function processBankUpdate(formData) {
  Logger.log("processBankUpdate called — clientRef: " + (formData.clientRef || "EMPTY"));

  var clientRef = formData.clientRef || "";
  var routing = formData.routing || "";
  var account = formData.account || "";
  var accountType = formData.accountType || "individual";
  var paymentNumber = formData.paymentNumber || "1";
  var token = formData.token || "";

  if (!clientRef || !routing || !account) {
    Logger.log("BankUpdate: Missing required fields");
    return;
  }

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var pipelineRow = findPipelineRow(pipeline, clientRef);
  if (pipelineRow === 0) { Logger.log("BankUpdate: No pipeline row for " + clientRef); return; }

  // Verify token
  var storedToken = String(pipeline.getRange(pipelineRow, COL.BANK_TOKEN).getValue()).trim();
  if (!token || token !== storedToken) {
    Logger.log("BankUpdate: Invalid token for " + clientRef + " — received: " + token + " expected: " + storedToken);
    throw new Error("Invalid or expired link");
  }

  var customerId = String(pipeline.getRange(pipelineRow, COL.STRIPE_CUSTOMER_ID).getValue()).trim();
  if (!customerId) { Logger.log("BankUpdate: No Stripe customer ID for " + clientRef); return; }

  var clientName = String(pipeline.getRange(pipelineRow, COL.CLIENT_FIRST).getValue()).trim() + " " + String(pipeline.getRange(pipelineRow, COL.CLIENT_LAST).getValue()).trim();

  // Create new bank token
  var token_stripe = stripeRequest("tokens", {
    "bank_account[country]": "US",
    "bank_account[currency]": "usd",
    "bank_account[account_holder_name]": clientName,
    "bank_account[account_holder_type]": accountType,
    "bank_account[routing_number]": routing,
    "bank_account[account_number]": account
  });

  if (!token_stripe || !token_stripe.id) {
    Logger.log("BankUpdate: Failed to create bank token");
    return;
  }

  // Attach to customer
  var bankSource = stripeRequest("customers/" + customerId + "/sources", {
    "source": token_stripe.id
  });

  if (!bankSource || !bankSource.id) {
    Logger.log("BankUpdate: Failed to attach bank account");
    return;
  }

  // Test mode verify
  if (STRIPE_API_KEY.indexOf("sk_test_") === 0) {
    stripeRequest("customers/" + customerId + "/sources/" + bankSource.id + "/verify", {
      "amounts[0]": "32",
      "amounts[1]": "45"
    });
    Logger.log("BankUpdate: Test mode — bank verified");
  }

  // Update Pipeline
  pipeline.getRange(pipelineRow, COL.STRIPE_BANK_TOKEN).setValue(bankSource.id);
  pipeline.getRange(pipelineRow, COL.ACCT_LAST4).setValue(account.slice(-4));

  // Clear the bank token so the link can't be reused
  pipeline.getRange(pipelineRow, COL.BANK_TOKEN).setValue("");

  // Set payment status back — "Ready" for payment 1, "scheduled" for 2-4
  var tz = Session.getScriptTimeZone();
  var tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000));
  var tomorrowStr = Utilities.formatDate(tomorrow, tz, "M/d/yyyy");

  var payNum = parseInt(paymentNumber) || 1;
  var statusCol = 0;
  var dateCol = 0;
  if (payNum === 1) { statusCol = COL.PAY1_STATUS; dateCol = COL.PAY1_DATE; }
  else if (payNum === 2) { statusCol = COL.PAY2_STATUS; dateCol = COL.PAY2_DATE; }
  else if (payNum === 3) { statusCol = COL.PAY3_STATUS; dateCol = COL.PAY3_DATE; }
  else if (payNum === 4) { statusCol = COL.PAY4_STATUS; dateCol = COL.PAY4_DATE; }

  if (statusCol > 0) {
    pipeline.getRange(pipelineRow, statusCol).setValue(payNum === 1 ? "Ready" : "scheduled");
    pipeline.getRange(pipelineRow, dateCol).setValue(tomorrowStr);
  }

  Logger.log("BankUpdate: Complete for " + clientRef + " — new bank token: " + bankSource.id + " | Payment " + payNum + " rescheduled for " + tomorrowStr);
}

function getBankUpdateFormHtml_() {
  return '<!DOCTYPE html>\
<html>\
<head>\
  <meta charset="utf-8">\
  <meta name="viewport" content="width=device-width, initial-scale=1.0">\
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">\
  <style>\
    * { margin: 0; padding: 0; box-sizing: border-box; }\
    body { font-family: "DM Sans", sans-serif; background: #0a1628; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }\
    .card { background: #0d1b2a; border-radius: 16px; padding: 40px; max-width: 500px; width: 100%; border: 1px solid rgba(255,255,255,0.06); }\
    h1 { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 8px; }\
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 28px; }\
    .client-badge { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }\
    .client-badge .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }\
    .client-badge .value { font-size: 15px; font-weight: 600; color: #fff; margin-top: 4px; }\
    .field { margin-bottom: 20px; }\
    .field label { display: block; font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }\
    .field input, .field select { width: 100%; padding: 12px 14px; background: #1b2a3d; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 14px; font-family: "DM Sans", sans-serif; }\
    .field input:focus, .field select:focus { outline: none; border-color: #3b82f6; }\
    .secure-note { display: flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #4ade80; }\
    .btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: "DM Sans", sans-serif; }\
    .btn:hover { background: #1d4ed8; }\
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }\
    .success { display: none; text-align: center; padding: 40px 20px; }\
    .success .icon { font-size: 48px; margin-bottom: 16px; }\
    .success h2 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 8px; }\
    .success p { font-size: 14px; color: #64748b; }\
    .error { display: none; text-align: center; padding: 40px 20px; }\
    .error .icon { font-size: 48px; margin-bottom: 16px; }\
    .error h2 { font-size: 20px; font-weight: 700; color: #ef4444; margin-bottom: 8px; }\
    .error p { font-size: 14px; color: #64748b; }\
  </style>\
</head>\
<body>\
  <div class="card">\
    <div id="formContainer">\
      <h1>Update Bank Details</h1>\
      <p class="subtitle">Please enter your updated banking information below.</p>\
      <div class="client-badge">\
        <div class="label">Client Reference</div>\
        <div class="value"><?= clientName ?> (<?= clientRef ?>)</div>\
      </div>\
      <div class="secure-note">🔒 Your bank details are sent directly to Stripe and are never stored in our systems.</div>\
      <div class="field">\
        <label>Routing Number</label>\
        <input type="text" id="routing" maxlength="9" placeholder="9-digit routing number">\
      </div>\
      <div class="field">\
        <label>Account Number</label>\
        <input type="text" id="account" placeholder="Account number">\
      </div>\
      <div class="field">\
        <label>Account Type</label>\
        <select id="accountType">\
          <option value="individual">Personal / Individual</option>\
          <option value="company">Business / Company</option>\
        </select>\
      </div>\
      <button class="btn" id="submitBtn" onclick="submitForm()">Update Bank Details</button>\
    </div>\
    <div class="success" id="successContainer">\
      <div class="icon">✅</div>\
      <h2>Bank Details Updated</h2>\
      <p>Your payment will be retried automatically. You can close this page.</p>\
    </div>\
    <div class="error" id="errorContainer">\
      <div class="icon">⚠️</div>\
      <h2>Something Went Wrong</h2>\
      <p>This link may have expired or already been used. Please contact your Proactive Facilitator for a new link.</p>\
    </div>\
  </div>\
  <script>\
    function submitForm() {\
      var routing = document.getElementById("routing").value.trim();\
      var account = document.getElementById("account").value.trim();\
      var accountType = document.getElementById("accountType").value;\
      if (!routing || routing.length !== 9) { alert("Please enter a valid 9-digit routing number."); return; }\
      if (!account) { alert("Please enter your account number."); return; }\
      var btn = document.getElementById("submitBtn");\
      btn.disabled = true;\
      btn.textContent = "Updating...";\
      var formData = {\
        clientRef: "<?= clientRef ?>",\
        paymentNumber: "<?= paymentNumber ?>",\
        token: "<?= token ?>",\
        routing: routing,\
        account: account,\
        accountType: accountType\
      };\
      google.script.run\
        .withSuccessHandler(function() {\
          document.getElementById("formContainer").style.display = "none";\
          document.getElementById("successContainer").style.display = "block";\
        })\
        .withFailureHandler(function(err) {\
          document.getElementById("formContainer").style.display = "none";\
          document.getElementById("errorContainer").style.display = "block";\
        })\
        .processBankUpdate(formData);\
    }\
  </script>\
</body>\
</html>';
}

// ============================================================
// C16 — AGREEMENT PDF GENERATION
// ============================================================

function generateAgreementPDF(clientData) {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var sheet = ss.getSheetByName("Agreement Templates");
  if (!sheet) { Logger.log("Agreement Templates sheet not found"); return null; }

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var html = "";
  var templateId = "";

  for (var i = 0; i < data.length; i++) {
    var svcLevel = String(data[i][0]).trim();
    var payPlan = String(data[i][1]).trim();
    if (svcLevel === clientData.serviceLevel && payPlan === clientData.paymentPlan) {
      html = String(data[i][3]);
      templateId = String(data[i][4]).trim();
      break;
    }
  }

  if (!html) { Logger.log("No template found for " + clientData.serviceLevel + " / " + clientData.paymentPlan); return null; }

  var today = new Date();
  var tz = Session.getScriptTimeZone();
  var date2 = new Date(today.getTime() + (91 * 24 * 60 * 60 * 1000));
  var date3 = new Date(today.getTime() + (182 * 24 * 60 * 60 * 1000));
  var date4 = new Date(today.getTime() + (273 * 24 * 60 * 60 * 1000));

  html = html
    .replace(/\[CLIENT_NAME\]/g, clientData.clientName || "")
    .replace(/\[CLIENT_EMAIL\]/g, clientData.clientEmail || "")
    .replace(/\[ANNUAL_FEE\]/g, clientData.annualFee || "")
    .replace(/\[QUARTERLY_FEE\]/g, clientData.quarterlyFee || "")
    .replace(/\[INITIAL_PAYMENT\]/g, clientData.initialPayment || "")
    .replace(/\[NUM_PRIORITIES\]/g, clientData.numPriorities || "")
    .replace(/\[NUM_MEETINGS\]/g, clientData.numMeetings || "")
    .replace(/\[PAYMENT_2_DATE\]/g, Utilities.formatDate(date2, tz, "M/dd/yyyy"))
    .replace(/\[PAYMENT_3_DATE\]/g, Utilities.formatDate(date3, tz, "M/dd/yyyy"))
    .replace(/\[PAYMENT_4_DATE\]/g, Utilities.formatDate(date4, tz, "M/dd/yyyy"));

  var blob = HtmlService.createHtmlOutput(html).getBlob().getAs("application/pdf");
  blob.setName(clientData.clientName + " - Proactive " + clientData.serviceLevel + " Agreement.pdf");

  return { blob: blob, templateId: templateId };
}

// ============================================================
// C16 — BOLDSIGN SEND DOCUMENT
// ============================================================

function sendToBoldSign(pdfBlob, templateId, clientData) {
  var BOLDSIGN_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "BOLDSIGN_API_KEY_SANDBOX" : "BOLDSIGN_API_KEY");
  var url = "https://api.boldsign.com/v1/document/send";

  function b(x, y, w, h) { return {"x":x,"y":y,"width":w,"height":h}; }

  var fieldMap = {
    "35a690b4-f3bd-417c-8bab-22d377281af2": { // Lite Quarterly
      ceoSig: {p:4,x:85,y:307,w:246,h:32}, ceoDate: {p:4,x:411.08,y:316.5,w:84.34,h:17},
      init1: {p:3,x:93,y:160,w:48,h:32}, init2: {p:3,x:93,y:233,w:48,h:32}, init3: {p:3,x:93,y:291,w:48,h:32}, init4: {p:3,x:93,y:351,w:48,h:32},
      clientSig: {p:4,x:83,y:559,w:241,h:32}, printName: {p:4,x:84,y:675.5,w:247,h:22}, clientDate: {p:4,x:413.08,y:679.5,w:84.34,h:17}
    },
    "5cc2c171-baa0-4441-8ce8-00fc33fe8985": { // Lite 1 Time
      ceoSig: {p:4,x:86,y:302,w:241,h:32}, ceoDate: {p:4,x:414.08,y:310.5,w:84.34,h:17},
      init1: {p:3,x:87,y:164,w:48,h:32}, init2: {p:3,x:87,y:237,w:48,h:32}, init3: {p:3,x:87,y:295,w:48,h:32}, init4: {p:3,x:87,y:355,w:48,h:32},
      clientSig: {p:4,x:82,y:554,w:236,h:32}, printName: {p:4,x:87,y:670.5,w:227,h:24}, clientDate: {p:4,x:414.08,y:670.5,w:84.34,h:17}
    },
    "465f51ed-643e-4281-bb6e-aad271b4c563": { // Core Quarterly
      ceoSig: {p:4,x:86,y:302,w:235,h:32}, ceoDate: {p:4,x:416.08,y:312.5,w:84.34,h:17},
      init1: {p:3,x:96,y:158,w:48,h:32}, init2: {p:3,x:96,y:236,w:48,h:32}, init3: {p:3,x:96,y:294,w:48,h:32}, init4: {p:3,x:96,y:356,w:48,h:32},
      clientSig: {p:4,x:82,y:552,w:242,h:34}, printName: {p:4,x:84,y:670.5,w:245,h:27}, clientDate: {p:4,x:414.08,y:672.5,w:84.34,h:17}
    },
    "af75ec93-fb8f-44b5-9153-b32b9a46db9f": { // Core 1 Time
      ceoSig: {p:4,x:83,y:307,w:248,h:32}, ceoDate: {p:4,x:412.08,y:316.5,w:84.34,h:17},
      init1: {p:3,x:94,y:161,w:48,h:32}, init2: {p:3,x:93,y:240,w:48,h:32}, init3: {p:3,x:93,y:293,w:48,h:32}, init4: {p:3,x:94,y:355,w:48,h:32},
      clientSig: {p:4,x:84,y:557,w:247,h:32}, printName: {p:4,x:85,y:678.5,w:241,h:20}, clientDate: {p:4,x:410.08,y:676.5,w:84.34,h:17}
    },
    "ebde4d68-0ea8-49de-b22e-85e6483518b1": { // Max Quarterly
      ceoSig: {p:4,x:83,y:220,w:247,h:32}, ceoDate: {p:4,x:410.08,y:227.5,w:84.34,h:17},
      init1: {p:3,x:93,y:162,w:48,h:32}, init2: {p:3,x:93,y:240,w:48,h:32}, init3: {p:3,x:93,y:298,w:48,h:32}, init4: {p:3,x:94,y:358,w:48,h:32},
      clientSig: {p:4,x:85,y:466,w:237,h:32}, printName: {p:4,x:84,y:587.5,w:247,h:24}, clientDate: {p:4,x:411.08,y:588.5,w:84.34,h:17}
    },
    "f2a3f8ea-6fa7-4ed2-ad41-bbe547eb3d9d": { // Max 1 Time
      ceoSig: {p:4,x:86,y:216,w:240,h:32}, ceoDate: {p:4,x:412.08,y:228.5,w:84.34,h:17},
      init1: {p:3,x:89,y:161,w:48,h:32}, init2: {p:3,x:88,y:240,w:48,h:32}, init3: {p:3,x:88,y:293,w:48,h:32}, init4: {p:3,x:89,y:355,w:48,h:32},
      clientSig: {p:4,x:85,y:470,w:246,h:32}, printName: {p:4,x:88,y:586.5,w:240,h:24}, clientDate: {p:4,x:409.08,y:592.5,w:84.34,h:17}
    }
  };

  var f = fieldMap[templateId];
  if (!f) { Logger.log("No field map for templateId: " + templateId); return null; }

  var boundary = "----BoldSign" + new Date().getTime();
  var requestBody = Utilities.newBlob("").getBytes();

  function addPart(name, value) {
    requestBody = requestBody.concat(
      Utilities.newBlob(
        "--" + boundary + "\r\n" +
        'Content-Disposition: form-data; name="' + name + '"\r\n\r\n' +
        value + "\r\n"
      ).getBytes()
    );
  }

  addPart("Title", clientData.clientName + " - VFO Membership Agreement");
  addPart("Message", "Please review and sign your VFO Services Membership Agreement.");
  addPart("EnableSigningOrder", "true");
  addPart("DisableEmails", "true");
  addPart("BrandId", "f6b2e092-73a4-438e-b786-ebd20e472732");

  var signer1 = JSON.stringify({
    "name": clientData.clientName,
    "emailAddress": clientData.clientEmail,
    "signerOrder": 1,
    "signerType": "Signer",
    "locale": "EN",
    "formFields": [
      {"id":"addr","fieldType":"Textbox","pageNumber":1,"isRequired":true,"bounds":b(103,255.5,612,17)},
      {"id":"phone","fieldType":"Textbox","pageNumber":1,"isRequired":true,"bounds":b(103,307.5,612,17)},
      {"id":"init1","fieldType":"Initial","pageNumber":f.init1.p,"isRequired":true,"bounds":b(f.init1.x,f.init1.y,f.init1.w,f.init1.h)},
      {"id":"init2","fieldType":"Initial","pageNumber":f.init2.p,"isRequired":true,"bounds":b(f.init2.x,f.init2.y,f.init2.w,f.init2.h)},
      {"id":"init3","fieldType":"Initial","pageNumber":f.init3.p,"isRequired":true,"bounds":b(f.init3.x,f.init3.y,f.init3.w,f.init3.h)},
      {"id":"init4","fieldType":"Initial","pageNumber":f.init4.p,"isRequired":true,"bounds":b(f.init4.x,f.init4.y,f.init4.w,f.init4.h)},
      {"id":"clientSig","fieldType":"Signature","pageNumber":f.clientSig.p,"isRequired":true,"bounds":b(f.clientSig.x,f.clientSig.y,f.clientSig.w,f.clientSig.h)},
      {"id":"printName","fieldType":"Textbox","pageNumber":f.printName.p,"isRequired":true,"bounds":b(f.printName.x,f.printName.y,f.printName.w,f.printName.h)},
      {"id":"clientDate","fieldType":"DateSigned","pageNumber":f.clientDate.p,"isRequired":true,"bounds":b(f.clientDate.x,f.clientDate.y,f.clientDate.w,f.clientDate.h)}
    ]
  });

  var signer2 = JSON.stringify({
    "name": "Anton Anderson",
    "emailAddress": "aanderson@elitert.com",
    "signerOrder": 2,
    "signerType": "Signer",
    "locale": "EN",
    "formFields": [
      {"id":"ceo_sig","fieldType":"Signature","pageNumber":f.ceoSig.p,"isRequired":true,"bounds":b(f.ceoSig.x,f.ceoSig.y,f.ceoSig.w,f.ceoSig.h)},
      {"id":"ceo_date","fieldType":"DateSigned","pageNumber":f.ceoDate.p,"isRequired":true,"bounds":b(f.ceoDate.x,f.ceoDate.y,f.ceoDate.w,f.ceoDate.h)}
    ]
  });

  addPart("Signers", signer1);
  addPart("Signers", signer2);

  requestBody = requestBody.concat(
    Utilities.newBlob(
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="Files"; filename="agreement.pdf"\r\n' +
      "Content-Type: application/pdf\r\n\r\n"
    ).getBytes()
  );
  requestBody = requestBody.concat(pdfBlob.getBytes());
  requestBody = requestBody.concat(Utilities.newBlob("\r\n--" + boundary + "--\r\n").getBytes());

  var options = {
    method: "post",
    contentType: "multipart/form-data; boundary=" + boundary,
    headers: { "X-API-KEY": BOLDSIGN_API_KEY },
    payload: requestBody,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  Logger.log("BoldSign status: " + code + " body: " + body);

  if (code === 200 || code === 201) {
    var result = JSON.parse(body);
    return result.documentId;
  } else {
    Logger.log("BoldSign ERROR: " + body);
    return null;
  }
}

// ============================================================
// C16 — GET BOLDSIGN SIGNING URL
// ============================================================

function getBoldSignSigningUrl(documentId, signerEmail) {
  var BOLDSIGN_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "BOLDSIGN_API_KEY_SANDBOX" : "BOLDSIGN_API_KEY");
  var url = "https://api.boldsign.com/v1/document/getEmbeddedSignLink?documentId=" + documentId + "&signerEmail=" + encodeURIComponent(signerEmail);

  var options = {
    method: "get",
    headers: { "X-API-KEY": BOLDSIGN_API_KEY },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  Logger.log("BoldSign sign link status: " + code + " body: " + body);

  if (code === 200) {
    var result = JSON.parse(body);
    return result.signLink || null;
  }
  return null;
}

// ============================================================
// C16/C17/C18 — BOLDSIGN WEBHOOK HANDLER (sets flags only)
// ============================================================

function handleBoldSignWebhook(payload) {
  var eventType = "";
  if (payload.event && payload.event.eventType) eventType = payload.event.eventType;

  var documentId = "";
  if (payload.context && payload.context.documentId) documentId = payload.context.documentId;
  if (!documentId && payload.data && payload.data.documentId) documentId = payload.data.documentId;

  if (!documentId) { Logger.log("No documentId in webhook"); return; }

  Logger.log("BoldSign webhook: " + eventType + " docId: " + documentId);

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();

  for (var i = 0; i < data.length; i++) {
    var rowDocId = String(data[i][COL.BOLDSIGN_DOC_ID - 1]).trim();
    if (rowDocId !== documentId) continue;

    var pipelineRow = i + 2;
    var c17 = String(data[i][COL.C17_CLIENT_SIGNED - 1]).trim();
    var clientRef = String(data[i][COL.CLIENT_REF - 1]).trim();
    var sourceSSID = String(data[i][COL.SOURCE_SS_ID - 1]).trim();

    // Determine which signer from the payload
    var signerIndex = -1;
    if (payload.data && payload.data.signerDetails) {
      var signerEmail = "";
      if (payload.data.signerDetails.signerEmail) signerEmail = String(payload.data.signerDetails.signerEmail).trim().toLowerCase();
      if (payload.data.signerDetails.emailAddress) signerEmail = String(payload.data.signerDetails.emailAddress).trim().toLowerCase();
      if (signerEmail === "aanderson@elitert.com") {
        signerIndex = 1;
      } else if (signerEmail) {
        signerIndex = 0;
      }
    }

    Logger.log("Webhook match row " + pipelineRow + " C17=" + c17 + " event=" + eventType + " signerIndex=" + signerIndex);

    if (eventType === "Completed") {
      if (c17 === "No") pipeline.getRange(pipelineRow, COL.C17_CLIENT_SIGNED).setValue("Yes");
      if (String(data[i][COL.C18_CEO_SIGNED - 1]).trim() !== "Yes") pipeline.getRange(pipelineRow, COL.C18_CEO_SIGNED).setValue("Yes");
      updateClientTrackingCell(sourceSSID, clientRef, "G40");
      updateClientTrackingCell(sourceSSID, clientRef, "G41");
      Logger.log("Fully executed for " + clientRef);

    } else if (eventType === "Signed") {
      if (signerIndex === 0 && c17 === "No") {
        pipeline.getRange(pipelineRow, COL.C17_CLIENT_SIGNED).setValue("Yes");
        updateClientTrackingCell(sourceSSID, clientRef, "G40");
        Logger.log("Client signed for " + clientRef);

      } else if (signerIndex === 1 && String(data[i][COL.C18_CEO_SIGNED - 1]).trim() !== "Yes") {
        pipeline.getRange(pipelineRow, COL.C18_CEO_SIGNED).setValue("Yes");
        updateClientTrackingCell(sourceSSID, clientRef, "G41");
        Logger.log("CEO countersigned for " + clientRef);

      } else if (signerIndex === -1) {
        // Fallback: couldn't identify signer from payload, use old logic but add duplicate guard
        if (c17 === "No") {
          pipeline.getRange(pipelineRow, COL.C17_CLIENT_SIGNED).setValue("Yes");
          updateClientTrackingCell(sourceSSID, clientRef, "G40");
          Logger.log("Client signed (fallback) for " + clientRef);
        }
        // Do NOT set C18 in fallback — let the poller handle it safely
        Logger.log("Signer not identified from webhook payload for " + clientRef + " — poller will catch CEO signature");

      } else {
        Logger.log("Duplicate or already-processed webhook for " + clientRef + " signerIndex=" + signerIndex + " C17=" + c17);
      }
    }
    break;
  }
}

// ============================================================
// C19 — STRIPE WEBHOOK HANDLER (sets flags only)
// ============================================================

function handleStripeWebhook(payload) {
  var eventType = String(payload.type || "").trim();
  Logger.log("Stripe webhook: " + eventType);

  // Handle Checkout Session completed — client entered bank details via Stripe Checkout
  if (eventType === "checkout.session.completed") {
    var session = payload.data && payload.data.object ? payload.data.object : null;
    if (!session) { Logger.log("No session object in checkout webhook"); return; }

    var customerId = session.customer || "";
    if (!customerId) { Logger.log("No customer ID in checkout session"); return; }

    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return;

    // Find pipeline row by customer ID
    var lastRow = pipeline.getLastRow();
    if (lastRow < 2) return;
    var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();
    var pipelineRow = 0;
    var clientRef = "";

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][COL.STRIPE_CUSTOMER_ID - 1]).trim() === customerId) {
        pipelineRow = i + 2;
        clientRef = String(data[i][COL.CLIENT_REF - 1]).trim();
        break;
      }
    }

    if (pipelineRow === 0) { Logger.log("No pipeline row for customer " + customerId); return; }

    // Get payment intent to extract payment method
    var paymentIntentId = session.payment_intent || "";
    if (paymentIntentId) {
      var STRIPE_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "STRIPE_API_KEY_SANDBOX" : "STRIPE_API_KEY");
      var piUrl = "https://api.stripe.com/v1/payment_intents/" + paymentIntentId;
      var piResp = UrlFetchApp.fetch(piUrl, {
        method: "get",
        headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
        muteHttpExceptions: true
      });

      if (piResp.getResponseCode() === 200) {
        var piData = JSON.parse(piResp.getContentText());
        var paymentMethodId = piData.payment_method || "";

        if (paymentMethodId) {
          pipeline.getRange(pipelineRow, COL.STRIPE_BANK_TOKEN).setValue(paymentMethodId);
          Logger.log("Checkout: Payment method stored: " + paymentMethodId + " for " + clientRef);

          // Get last 4 digits from payment method
          var pmUrl = "https://api.stripe.com/v1/payment_methods/" + paymentMethodId;
          var pmResp = UrlFetchApp.fetch(pmUrl, {
            method: "get",
            headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
            muteHttpExceptions: true
          });

          if (pmResp.getResponseCode() === 200) {
            var pmData = JSON.parse(pmResp.getContentText());
            var last4 = "";
            if (pmData.us_bank_account && pmData.us_bank_account.last4) {
              last4 = pmData.us_bank_account.last4;
            } else if (pmData.card && pmData.card.last4) {
              last4 = pmData.card.last4;
            }
            if (last4) {
              pipeline.getRange(pipelineRow, COL.ACCT_LAST4).setValue(last4);
              Logger.log("Checkout: Account last4: " + last4 + " for " + clientRef);
            }
          }
        }
      }
    }

    // Check payment intent status — if already succeeded, set pipeline status immediately
    if (paymentIntentId) {
      var piCheckUrl = "https://api.stripe.com/v1/payment_intents/" + paymentIntentId;
      var piCheckResp = UrlFetchApp.fetch(piCheckUrl, {
        method: "get",
        headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
        muteHttpExceptions: true
      });

      if (piCheckResp.getResponseCode() === 200) {
        var piCheckData = JSON.parse(piCheckResp.getContentText());
        var piStatus = piCheckData.status || "";

        if (piStatus === "succeeded" || piStatus === "processing") {
          pipeline.getRange(pipelineRow, COL.PAY1_STATUS).setValue(piStatus);
          pipeline.getRange(pipelineRow, COL.PAY1_DATE).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy"));
          pipeline.getRange(pipelineRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
          if (piStatus === "succeeded") {
            pipeline.getRange(pipelineRow, COL.REC1_STATUS).setValue("Receipt Needed");
          }
          Logger.log("Checkout: Payment " + piStatus + " for " + clientRef + " — confirmation triggered");
        } else if (piStatus === "requires_action") {
          pipeline.getRange(pipelineRow, COL.PAY1_STATUS).setValue("requires_action");
          Logger.log("Checkout: Payment requires_action for " + clientRef + " — awaiting micro-deposit verification");
        }
      }
    }

    Logger.log("Checkout session completed for " + clientRef);
    return;
  }

  // Handle payment intent events
  if (eventType !== "payment_intent.succeeded" && eventType !== "payment_intent.payment_failed") {
    Logger.log("Stripe webhook ignored: " + eventType);
    return;
  }

  var pi = payload.data && payload.data.object ? payload.data.object : null;
  if (!pi) { Logger.log("No payment intent object in webhook"); return; }

  var clientRef = (pi.metadata && pi.metadata.client_ref) ? pi.metadata.client_ref : "";
  var paymentNumber = (pi.metadata && pi.metadata.payment_number) ? pi.metadata.payment_number : "";
  var status = eventType === "payment_intent.succeeded" ? "succeeded" : "failed";

  Logger.log("Stripe webhook: clientRef=" + clientRef + " payment#=" + paymentNumber + " status=" + status);

  if (!clientRef || !paymentNumber) {
    Logger.log("Missing metadata in Stripe webhook");
    return;
  }

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var pipelineRow = findPipelineRow(pipeline, clientRef);
  if (pipelineRow === 0) { Logger.log("No pipeline row for " + clientRef); return; }

  var statusCol = 0;
  var dateCol = 0;
  if (paymentNumber === "1") { statusCol = COL.PAY1_STATUS; dateCol = COL.PAY1_DATE; }
  else if (paymentNumber === "2") { statusCol = COL.PAY2_STATUS; dateCol = COL.PAY2_DATE; }
  else if (paymentNumber === "3") { statusCol = COL.PAY3_STATUS; dateCol = COL.PAY3_DATE; }
  else if (paymentNumber === "4") { statusCol = COL.PAY4_STATUS; dateCol = COL.PAY4_DATE; }

  if (statusCol > 0) {
    pipeline.getRange(pipelineRow, statusCol).setValue(status);
    pipeline.getRange(pipelineRow, dateCol).setValue(
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy")
    );
    Logger.log("Payment " + paymentNumber + " = " + status + " for " + clientRef);
  }

  // Set confirmation status for payment 1 only (if not already sent)
  if (status === "succeeded" && paymentNumber === "1") {
    var currentConfirm = String(pipeline.getRange(pipelineRow, COL.CONFIRMATION_STATUS).getValue()).trim();
    if (currentConfirm !== "Confirmation Sent") {
      pipeline.getRange(pipelineRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
    }
    pipeline.getRange(pipelineRow, COL.REC1_STATUS).setValue("Receipt Needed");
  }

  // Set the correct REC status column for succeeded payments only
  var recStatusCols = {
    "1": COL.REC1_STATUS,
    "2": COL.REC2_STATUS,
    "3": COL.REC3_STATUS,
    "4": COL.REC4_STATUS
  };

  var recStatusCol = recStatusCols[paymentNumber];
  if (recStatusCol) {
    if (status === "succeeded" && paymentNumber !== "1") {
      var currentRecStatus = String(pipeline.getRange(pipelineRow, recStatusCol).getValue()).trim();
      if (!currentRecStatus || currentRecStatus === "") {
        pipeline.getRange(pipelineRow, recStatusCol).setValue("Receipt Needed");
      }
    }
  }

  Logger.log("Stripe webhook complete for " + clientRef);
}

function handleStripePayRedirect(params) {
  var clientRef = params.clientRef || "";
  var token = params.token || "";
  var method = params.method || "";

  if (!clientRef || !token) {
    return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>Invalid Link</h2><p style="color:#94a3b8;">This payment link is missing required information.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = masterSS.getSheetByName(PIPELINE_TAB);
  if (!pipeline) {
    return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>System Error</h2><p style="color:#94a3b8;">Please contact VFO Services for assistance.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var pipelineRow = findPipelineRow(pipeline, clientRef);
  if (pipelineRow === 0) {
    return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>Client Not Found</h2><p style="color:#94a3b8;">We could not locate your record. Please contact VFO Services.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var storedToken = String(pipeline.getRange(pipelineRow, COL.CHECKOUT_TOKEN).getValue()).trim();
  if (token !== storedToken) {
    return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>Invalid or Expired Link</h2><p style="color:#94a3b8;">This payment link is no longer valid. Please contact VFO Services for a new link.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var pay1Status = String(pipeline.getRange(pipelineRow, COL.PAY1_STATUS).getValue()).trim();
  if (pay1Status === "succeeded") {
    return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;">✓</div><h2>Payment Already Received</h2><p style="color:#94a3b8;">Your payment has already been processed. No further action is needed.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var data = pipeline.getRange(pipelineRow, 1, 1, COL.SOURCE_SHEET_NAME).getValues()[0];
  var customerId = String(data[COL.STRIPE_CUSTOMER_ID - 1]).trim();
  var clientName = String(data[COL.CLIENT_FIRST - 1]).trim() + " " + String(data[COL.CLIENT_LAST - 1]).trim();
  var clientEmail = String(data[COL.CLIENT_EMAIL - 1]).trim();
  var serviceLevel = String(data[COL.SERVICE_LEVEL - 1]).trim();
  var paymentPlan = String(data[COL.PAYMENT_PLAN - 1]).trim();
  var netInvoice = parseFloat(String(data[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;

  var paymentAmount = netInvoice;
  if (paymentPlan === "Quarterly" && netInvoice > 0) {
    paymentAmount = netInvoice / 4;
  }
  var numPayments = paymentPlan === "Quarterly" ? "4" : "1";

  var cardFee = Math.round((paymentAmount * 0.029 + 0.30) * 100) / 100;
  var cardTotal = Math.round((paymentAmount + cardFee) * 100) / 100;

  if (!customerId) {
    var customer = stripeRequest("customers", {
      "name": clientName,
      "email": clientEmail,
      "metadata[client_ref]": clientRef,
      "metadata[service_level]": serviceLevel
    });
    if (!customer || !customer.id) {
      return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>Payment Setup Error</h2><p style="color:#94a3b8;">We could not set up your payment. Please try again or contact VFO Services.</p></div></body></html>')
        .setTitle("VFO Services")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    customerId = customer.id;
    pipeline.getRange(pipelineRow, COL.STRIPE_CUSTOMER_ID).setValue(customerId);
  }

  if (method === "ach" || method === "card") {
    var paymentMethodType = method === "card" ? "card" : "us_bank_account";
    var chargeAmount = method === "card" ? cardTotal : paymentAmount;
    var productName = method === "card"
      ? "VFO Services — " + serviceLevel + " Membership (Payment 1 of " + numPayments + ") ($" + formatMoney(paymentAmount) + " + $" + formatMoney(cardFee) + " card fee)"
      : "VFO Services — " + serviceLevel + " Membership (Payment 1 of " + numPayments + ")";

    var session = stripeRequest("checkout/sessions", {
      "customer": customerId,
      "mode": "payment",
      "payment_method_types[]": paymentMethodType,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(chargeAmount * 100)),
      "line_items[0][price_data][product_data][name]": productName,
      "line_items[0][quantity]": "1",
      "payment_intent_data[metadata][client_ref]": clientRef,
      "payment_intent_data[metadata][payment_number]": "1",
      "payment_intent_data[metadata][payment_method_type]": method,
      "payment_intent_data[metadata][card_fee]": method === "card" ? String(cardFee) : "0",
      "payment_intent_data[setup_future_usage]": "off_session",
      "success_url": "https://www.vfo-services.com/payment-successful/",
      "cancel_url": WEB_APP_URL + "?action=stripepay&clientRef=" + encodeURIComponent(clientRef) + "&token=" + encodeURIComponent(token),
      "expires_at": String(Math.floor(new Date().getTime() / 1000) + 86400)
    });

    if (!session || !session.url) {
      return HtmlService.createHtmlOutput('<html><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;"><div style="text-align:center;"><h2>Payment Session Error</h2><p style="color:#94a3b8;">We could not create your payment session. Please try again or contact VFO Services.</p></div></body></html>')
        .setTitle("VFO Services")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    pipeline.getRange(pipelineRow, COL.PAYMENT_METHOD_TYPE).setValue(method);
    if (method === "card") {
      pipeline.getRange(pipelineRow, COL.CARD_PROCESSING_FEE).setValue(cardFee);
    }

    Logger.log("StripePayRedirect: " + method + " checkout created for " + clientRef + " | Amount: $" + formatMoney(chargeAmount));

    return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;max-width:480px;"><div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:28px;">🔒</div><h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;">VFO Services Payment</h1><p style="color:#94a3b8;font-size:14px;margin-bottom:32px;">Your secure payment session is ready. Click below to complete your payment via Stripe.</p><a href="' + session.url + '" target="_top" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.3px;">Proceed to Payment</a><p style="color:#475569;font-size:12px;margin-top:24px;">Your payment details are handled securely by Stripe.<br>VFO Services never sees or stores your payment information.</p></div></body></html>')
      .setTitle("VFO Services — Payment")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var achUrl = WEB_APP_URL + "?action=stripepay&clientRef=" + encodeURIComponent(clientRef) + "&token=" + encodeURIComponent(token) + "&method=ach";
  var cardUrl = WEB_APP_URL + "?action=stripepay&clientRef=" + encodeURIComponent(clientRef) + "&token=" + encodeURIComponent(token) + "&method=card";

  return HtmlService.createHtmlOutput('<html><head>'
    + '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>'
    + '* { margin:0; padding:0; box-sizing:border-box; }'
    + 'body { font-family:"DM Sans",sans-serif; background:#0a1628; color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }'
    + '.container { max-width:540px; width:100%; }'
    + '.lock-icon { width:64px; height:64px; background:rgba(34,197,94,0.15); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; font-size:28px; }'
    + 'h1 { font-size:22px; font-weight:700; color:#fff; text-align:center; margin-bottom:8px; }'
    + '.subtitle { color:#94a3b8; font-size:14px; text-align:center; margin-bottom:32px; }'
    + '.option { border:2px solid rgba(255,255,255,0.1); border-radius:16px; padding:28px; margin-bottom:16px; cursor:pointer; transition:all 0.2s; text-decoration:none; display:block; }'
    + '.option:hover { border-color:#3b82f6; background:rgba(59,130,246,0.05); }'
    + '.option-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }'
    + '.option-title { font-size:16px; font-weight:700; color:#fff; }'
    + '.option-badge { font-size:11px; font-weight:600; padding:4px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; }'
    + '.badge-green { background:rgba(34,197,94,0.15); color:#4ade80; }'
    + '.badge-blue { background:rgba(59,130,246,0.15); color:#60a5fa; }'
    + '.option-amount { font-size:28px; font-weight:700; color:#fff; margin-bottom:4px; }'
    + '.option-breakdown { font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.6; }'
    + '.option-detail { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; }'
    + '.option-detail .label { color:#64748b; }'
    + '.option-detail .value { color:#e2e8f0; font-weight:600; }'
    + '.option-footer { font-size:12px; color:#475569; margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.06); }'
    + '.divider { text-align:center; color:#475569; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin:8px 0; }'
    + '.security-note { text-align:center; color:#475569; font-size:12px; margin-top:24px; }'
    + '</style></head><body>'
    + '<div class="container">'
    + '<div class="lock-icon">🔒</div>'
    + '<h1>VFO Services Payment</h1>'
    + '<p class="subtitle">Choose your preferred payment method</p>'

    + '<a href="' + achUrl + '" target="_top" class="option">'
    + '<div class="option-header">'
    + '<span class="option-title">🏦 ACH Bank Transfer</span>'
    + '<span class="option-badge badge-green">No Fee</span>'
    + '</div>'
    + '<div class="option-amount">$' + formatMoney(paymentAmount) + '</div>'
    + '<div class="option-breakdown">'
    + '<div class="option-detail"><span class="label">' + serviceLevel + ' Membership (Payment 1 of ' + numPayments + ')</span><span class="value">$' + formatMoney(paymentAmount) + '</span></div>'
    + '<div class="option-detail"><span class="label">Processing Fee</span><span class="value" style="color:#4ade80;">$0.00</span></div>'
    + '</div>'
    + '<div class="option-footer">Funds transfer directly from your bank account. Takes 2-4 business days to process.</div>'
    + '</a>'

    + '<div class="divider">— or —</div>'

    + '<a href="' + cardUrl + '" target="_top" class="option">'
    + '<div class="option-header">'
    + '<span class="option-title">💳 Credit / Debit Card</span>'
    + '<span class="option-badge badge-blue">2.9% + $0.30 Fee</span>'
    + '</div>'
    + '<div class="option-amount">$' + formatMoney(cardTotal) + '</div>'
    + '<div class="option-breakdown">'
    + '<div class="option-detail"><span class="label">' + serviceLevel + ' Membership (Payment 1 of ' + numPayments + ')</span><span class="value">$' + formatMoney(paymentAmount) + '</span></div>'
    + '<div class="option-detail"><span class="label">Card Processing Fee (2.9% + $0.30)</span><span class="value">$' + formatMoney(cardFee) + '</span></div>'
    + '</div>'
    + '<div class="option-footer">Processes immediately. The processing fee covers card transaction costs.</div>'
    + '</a>'

    + '<p class="security-note">Your payment details are handled securely by Stripe.<br>VFO Services never sees or stores your payment information.</p>'
    + '</div></body></html>')
    .setTitle("VFO Services — Payment")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleConnectSetupRedirect(params) {
  var memberNum = params.memberNum || "";
  var token = params.token || "";

  if (!memberNum || !token) {
    return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;"><h2>Invalid Link</h2><p style="color:#94a3b8;">This setup link is missing required information.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Look up Connect ID from Member Master List
  var MEMBER_MASTER_ID = "1hV2h-E6YcolHQY50q_rb-ETx3iEEl9uvnngZajKgxCA";
  var memberSS = SpreadsheetApp.openById(MEMBER_MASTER_ID);
  var connectId = "";
  var memberName = "";

  var sheets = [
    { name: "Advisor Home", numCol: 1, firstCol: 2, lastCol: 3, connectCol: 21, tokenCol: 45 },
    { name: "Accountant Home", numCol: 1, firstCol: 3, lastCol: 4, connectCol: 27, tokenCol: 62 }
  ];

  var foundRow = 0;
  var foundSheet = null;
  var foundConfig = null;

  for (var s = 0; s < sheets.length; s++) {
    var config = sheets[s];
    var sheet = memberSS.getSheetByName(config.name);
    if (!sheet || sheet.getLastRow() < 2) continue;

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, config.tokenCol).getValues();

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === memberNum) {
        var storedToken = String(data[i][config.tokenCol - 1]).trim();
        if (token !== storedToken) {
          return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;"><h2>Invalid or Expired Link</h2><p style="color:#94a3b8;">This setup link is no longer valid. Please contact VFO Services.</p></div></body></html>')
            .setTitle("VFO Services")
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
        connectId = String(data[i][config.connectCol - 1]).trim();
        memberName = String(data[i][config.firstCol - 1]).trim() + " " + String(data[i][config.lastCol - 1]).trim();
        foundRow = i + 2;
        foundSheet = sheet;
        foundConfig = config;
        break;
      }
    }
    if (foundRow > 0) break;
  }

  if (!connectId) {
    return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;"><h2>Account Not Found</h2><p style="color:#94a3b8;">We could not locate your account. Please contact VFO Services.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Check if already onboarded
  var acctResp = UrlFetchApp.fetch("https://api.stripe.com/v1/accounts/" + connectId, {
    method: "get",
    headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
    muteHttpExceptions: true
  });

  if (acctResp.getResponseCode() === 200) {
    var acctData = JSON.parse(acctResp.getContentText());
    if (acctData.details_submitted) {
      return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;"><div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;">✓</div><h2>Already Set Up</h2><p style="color:#94a3b8;">Your payment details have already been configured. No further action is needed.</p></div></body></html>')
        .setTitle("VFO Services")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // Create fresh onboarding linkk
  var link = stripeRequest("account_links", {
    "account": connectId,
    "refresh_url": WEB_APP_URL + "?action=connectsetup&memberNum=" + encodeURIComponent(memberNum) + "&token=" + encodeURIComponent(token),
    "return_url": "https://elitert.com/setup-successful",
    "type": "account_onboarding"
  });

  if (!link || !link.url) {
    return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;"><h2>Setup Error</h2><p style="color:#94a3b8;">We could not create your setup session. Please try again or contact VFO Services.</p></div></body></html>')
      .setTitle("VFO Services")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  Logger.log("ConnectSetup: Fresh onboarding link created for " + memberName + " (" + memberNum + ")");

  return HtmlService.createHtmlOutput('<html><head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="font-family:DM Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a1628;color:#e2e8f0;margin:0;padding:20px;"><div style="text-align:center;max-width:480px;"><div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:28px;">🔒</div><h1 style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;">VFO Services — Payment Setup</h1><p style="color:#94a3b8;font-size:14px;margin-bottom:32px;">Click below to securely set up your payment details via Stripe.</p><a href="' + link.url + '" target="_top" style="display:inline-block;background:#16a34a;color:#fff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.3px;">Set Up Payment Details</a><p style="color:#475569;font-size:12px;margin-top:24px;">Your details are handled securely by Stripe.<br>VFO Services never sees or stores your banking information.</p></div></body></html>')
    .setTitle("VFO Services — Payment Setup")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

