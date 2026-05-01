// Automation












// MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1 - MAP 1













// ============================================================
// CONFIGURATION
// ============================================================

var MASTER_SS_ID = "1haENiw6ZeJuZPSokZC8UVJLRrwTiEiJgVTtbapbU_Tw";
var PIPELINE_TAB = "MAP 1 Pipeline";
var MAP1_SANDBOX = false;
var TAX_SANDBOX = false;

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
// UTILITIES
// ============================================================

function formatDollar(val) {
  var num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return val;
  return num.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

function formatMoney(amount) {
  var num = parseFloat(amount) || 0;
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

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


function sendPipelineHealthCheck() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

  var now = new Date();
  var twoHoursMs = 2 * 60 * 60 * 1000;
  var oneDayMs = 24 * 60 * 60 * 1000;

  var activeRows = [];
  var stuckRows = [];
  var completedRows = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    if (!clientRef) continue;

    var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
    var c13Decision = String(row[COL.C13_DECISION - 1]).trim();
    var c14Sent = String(row[COL.C14_EMAIL_SENT - 1]).trim();
    var c15Decision = String(row[COL.C15_FINAL_DECISION - 1]).trim();
    var c16Sent = String(row[COL.C16_SENT - 1]).trim();
    var c17Signed = String(row[COL.C17_CLIENT_SIGNED - 1]).trim();
    var c18Signed = String(row[COL.C18_CEO_SIGNED - 1]).trim();
    var pay1Status = String(row[COL.PAY1_STATUS - 1]).trim();
    var confirmStatus = String(row[COL.CONFIRMATION_STATUS - 1]).trim();
    var rec1Status = String(row[COL.REC1_STATUS - 1]).trim();
    var rec1RevShare = String(row[COL.REC1_REV_SHARE - 1]).trim();
    var rec1RevPaid = String(row[COL.REC1_REV_PAID - 1]).trim();
    var rec1RevEmail = String(row[COL.REC1_REV_EMAIL_SENT - 1]).trim();
    var c24Sent = String(row[COL.C24_EMAIL_SENT - 1]).trim();
    var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
    var c81EmailSent = String(row[COL.C81_EMAIL_SENT - 1]).trim();

    // Get row timestamp for age calculation
    var timestampVal = row[COL.TIMESTAMP - 1];
    var rowDate = null;
    if (timestampVal instanceof Date) {
      rowDate = timestampVal;
    } else if (timestampVal) {
      rowDate = new Date(timestampVal);
    }
    var rowAgeMs = rowDate ? (now - rowDate) : 0;
    var rowAgeDays = Math.floor(rowAgeMs / oneDayMs);

    // Determine current stage and any stuck conditions
    var currentStage = "";
    var stuckReason = "";
    var isComplete = false;

    // Dead end — No path complete
    if (c13Decision === "No" && c14Sent === "Yes") {
      isComplete = true;
      currentStage = "Closed — Client declined";
    }

    // C24 complete — fully done
    else if (c24Sent === "Yes") {
      isComplete = true;
      currentStage = "Complete — C24 sent";
    }

    // C23 rev email sent, waiting C24
    else if (rec1RevEmail === "Yes" && c24Sent !== "Yes") {
      currentStage = "C24 — Tracy intro email pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "C24 not sent after rev share email";
    }

    // Rev share paid, waiting C23
    else if (rec1RevPaid === "Yes" && rec1RevEmail !== "Yes") {
      currentStage = "C23 — Rev share email to member pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Rev share paid but member email not sent";
    }

    // Rev share verified, waiting payout
    else if (rec1RevShare === "Completed" && rec1RevPaid !== "Yes" && rec1RevPaid !== "N/A") {
      currentStage = "Rev share payout pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Rev share verified but payout not processed";
    }

    // Rev share pending — waiting Tracy
    else if (rec1RevShare === "Pending") {
      currentStage = "C22 — Waiting for Tracy to complete revenue share";
      if (rowAgeDays >= 1) stuckReason = "Revenue share has been Pending for " + rowAgeDays + " day(s)";
    }

    // Receipt sent, waiting rev share
    else if (rec1Status === "Sent" && rec1RevShare === "") {
      currentStage = "C22 — Revenue share not yet started";
      if (rowAgeMs > twoHoursMs) stuckReason = "Receipt sent but revenue share not initiated";
    }

    // Receipt needed
    else if (rec1Status === "Receipt Needed") {
      currentStage = "C20/C21 — Invoice and receipt generation pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Receipt needed but not yet generated";
    }

    // Confirmation sent, waiting receipt
    else if (confirmStatus === "Confirmation Sent" && rec1Status === "") {
      currentStage = "C20 — Waiting for receipt status to be set";
      if (rowAgeMs > twoHoursMs) stuckReason = "Confirmation sent but REC1 status not set";
    }

    // Confirmation needed
    else if (confirmStatus === "Confirmation Needed") {
      currentStage = "C19 — Payment confirmation email pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Confirmation needed but email not yet drafted";
    }

    // Payment processing
    else if (pay1Status === "processing" || pay1Status === "requires_action") {
      currentStage = "C19 — Payment processing with Stripe";
      if (rowAgeMs > oneDayMs) stuckReason = "Payment has been processing for over 24 hours";
    }

    // Payment failed
    else if (pay1Status === "failed" || pay1Status === "Manual Review") {
      currentStage = "C19 — Payment failed / manual review required";
      stuckReason = "Payment status: " + pay1Status;
    }

    // Payment ready but not yet processed
    else if (pay1Status === "Ready") {
      currentStage = "C19 — Payment ready to process";
      if (rowAgeMs > twoHoursMs) stuckReason = "Payment marked Ready but not yet processed";
    }

    // CEO signed, waiting C19 setup
    else if (c18Signed === "Yes" && pay1Status === "") {
      currentStage = "C19 Setup — Retrieving bank details from BoldSign";
      if (rowAgeMs > twoHoursMs) stuckReason = "CEO signed but payment setup not initiated";
    }

    // Client signed, waiting CEO countersign
    else if (c17Signed === "Yes" && (c18Signed === "No" || c18Signed === "Pending")) {
      currentStage = "C18 — Waiting for CEO countersignature";
      if (rowAgeMs > oneDayMs) stuckReason = "Client signed but CEO has not countersigned after 24 hours";
    }

    // Agreement sent, waiting client signature
    else if (c16Sent === "Yes" && c17Signed === "No") {
      currentStage = "C17 — Waiting for client to sign agreement";
      if (rowAgeDays >= 3) stuckReason = "Agreement sent but client has not signed after " + rowAgeDays + " days";
    }

    // PF pricing submitted, waiting agreement generation
    else if (c14Sent === "Yes" && c16Sent === "No" && (c13Decision === "Yes" || c15Decision === "Yes")) {
      currentStage = "C16 — Agreement generation pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Pricing confirmed but agreement not yet generated";
    }

    // PF pricing form sent, waiting PF to submit
    else if (c14Sent === "PF Pricing Sent") {
      currentStage = "C15Yes — Waiting for PF to complete pricing form";
      if (rowAgeDays >= 1) stuckReason = "PF pricing form sent but not submitted after " + rowAgeDays + " day(s)";
    }

    // PF pricing needed, not yet sent
    else if (c14Sent === "PF Pricing Needed") {
      currentStage = "C15Yes — PF pricing email not yet sent";
      if (rowAgeMs > twoHoursMs) stuckReason = "PF pricing needed but email not yet drafted";
    }

    // Extra meeting — PF email not yet sent
    else if (c14Sent === "Extra Meeting PF Needed") {
      currentStage = "C15 — Extra meeting requested, PF email pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "Extra meeting PF email not yet drafted";
    }

    // Extra meeting — waiting for PF to submit decision
    else if (c15Decision === "Extra Meeting") {
      currentStage = "C15 — Extra meeting requested, waiting for PF decision";
      if (rowAgeDays >= 7) stuckReason = "Extra meeting requested but PF has not submitted decision after " + rowAgeDays + " day(s)";
    }

    // Undecided/No email sent, waiting client response
    else if ((c13Decision === "Undecided" || c13Decision === "No") && c14Sent === "Yes" && c15Decision === "") {
      currentStage = "C15 — Waiting for client response to follow-up email";
      if (rowAgeDays >= 7) stuckReason = "Follow-up email sent but no client response after " + rowAgeDays + " days";
    }

    // C14 email pending
    else if ((c13Decision === "Undecided" || c13Decision === "No") && c14Sent === "No") {
      currentStage = "C14 — Follow-up email pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "C14 email queued but not yet drafted";
    }

    // C13 submitted, Yes path — waiting C16
    else if (c13Decision === "Yes" && c16Sent === "No") {
      currentStage = "C16 — Agreement generation pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "C13 Yes submitted but agreement not yet generated";
    }

    // C8.1 email pending
    else if (c81EmailSent === "No") {
      currentStage = "C8.1 — Client email pending";
      if (rowAgeMs > twoHoursMs) stuckReason = "C8.1 email queued but not yet drafted";
    }

    // C13 not yet submitted
    else if (c13Decision === "") {
      currentStage = "C13 — Awaiting outcome form submission";
    }

    else {
      currentStage = "In progress";
    }

    var rowSummary = {
      clientRef: clientRef,
      clientName: clientName,
      memberName: memberName,
      serviceLevel: serviceLevel || "—",
      currentStage: currentStage,
      stuckReason: stuckReason,
      rowAgeDays: rowAgeDays
    };

    if (isComplete) {
      completedRows.push(rowSummary);
    } else if (stuckReason) {
      stuckRows.push(rowSummary);
    } else {
      activeRows.push(rowSummary);
    }
  }

  // Build email
  var tz = Session.getScriptTimeZone();
  var dateStr = Utilities.formatDate(now, tz, "EEEE, MMMM d, yyyy");

  function buildTable(rows, headerColor) {
    if (rows.length === 0) return '<p style="color:#64748b;font-size:13px;font-style:italic;">None</p>';
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px;">'
      + '<thead><tr>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Client</th>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Ref</th>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Member</th>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Service</th>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Current Stage</th>'
      + '<th style="background:' + headerColor + ';color:white;padding:8px 12px;text-align:left;">Issue</th>'
      + '</tr></thead><tbody>';
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      html += '<tr style="' + (r % 2 === 0 ? 'background:#f8fafc;' : '') + '">'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + row.clientName + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + row.clientRef + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + row.memberName + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + row.serviceLevel + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + row.currentStage + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:' + (row.stuckReason ? '#dc2626' : '#64748b') + ';">' + (row.stuckReason || '—') + '</td>'
        + '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  var overallStatus = stuckRows.length === 0
    ? '<span style="color:#16a34a;font-weight:700;">✓ All Clear</span>'
    : '<span style="color:#dc2626;font-weight:700;">⚠ ' + stuckRows.length + ' item' + (stuckRows.length > 1 ? 's' : '') + ' require attention</span>';

  var emailBody = '<div style="font-family:Arial,sans-serif;max-width:900px;">'
    + '<div style="background:#00488d;color:white;padding:24px 32px;margin-bottom:24px;">'
    + '<h1 style="font-size:20px;font-weight:700;margin:0;">Pipeline Health Check</h1>'
    + '<p style="font-size:13px;opacity:0.8;margin:6px 0 0;">VFO Services — ' + dateStr + '</p>'
    + '</div>'
    + '<div style="padding:0 32px;">'
    + '<p style="font-size:15px;margin-bottom:24px;">Overall status: ' + overallStatus + '</p>'

    + '<h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#dc2626;margin-bottom:12px;">⚠ Needs Attention (' + stuckRows.length + ')</h2>'
    + buildTable(stuckRows, '#dc2626')

    + '<h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2563eb;margin-bottom:12px;margin-top:32px;">Active (' + activeRows.length + ')</h2>'
    + buildTable(activeRows, '#2563eb')

    + '<h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#16a34a;margin-bottom:12px;margin-top:32px;">Completed / Closed (' + completedRows.length + ')</h2>'
    + buildTable(completedRows, '#16a34a')

    + '</div>'
    + '<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;margin-top:24px;font-size:11px;color:#94a3b8;">'
    + 'Generated automatically by VFO Services Pipeline · ' + dateStr
    + '</div>'
    + '</div>';

  try {
    GmailApp.sendEmail("jlatham@elitert.com", "VFO Pipeline Health Check — " + dateStr, "", {
      htmlBody: emailBody,
      name: "VFO Services Pipeline"
    });
    Logger.log("Health check email sent — " + stuckRows.length + " stuck, " + activeRows.length + " active, " + completedRows.length + " complete");
  } catch (err) {
    Logger.log("Health check email error: " + err.message);
  }
}

function sendFollowUpEmails() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  var now = new Date();

  var followUpConfigs = [
    {
      label: "C14 Undecided",
      sentDateCol: COL.C14_FOLLOWUP_SENT_DATE,
      followUp1Col: COL.C14_FOLLOWUP1_SENT,
      followUp2Col: COL.C14_FOLLOWUP2_SENT,
      resolvedCheck: function(row) {
        var finalDecision = String(row[COL.C15_FINAL_DECISION - 1]).trim();
        return finalDecision === "Yes" || finalDecision === "No" || finalDecision === "Extra Meeting";
      },
      clientSubject: "Following Up — VFO Services Membership Decision",
      clientBody: function(clientFirst, pfName, row) {
        var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
        var c15Token = String(row[COL.C15_TOKEN - 1]).trim();
        var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
        var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
        var memberNum = String(row[COL.MEMBER_NUM - 1]).trim();
        var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();
        var maxMembership = String(row[COL.MAX_MEMBERSHIP - 1]).trim();
        var sentTimestamp = encodeURIComponent(new Date().toISOString());
        var baseParams = [
          "action=c15",
          "clientRef=" + encodeURIComponent(clientRef),
          "clientFirst=" + encodeURIComponent(clientFirst),
          "clientLast=" + encodeURIComponent(String(row[COL.CLIENT_LAST - 1]).trim()),
          "clientEmail=" + encodeURIComponent(clientEmail),
          "memberNum=" + encodeURIComponent(memberNum),
          "ssId=" + encodeURIComponent(sourceSSID),
          "sent=" + sentTimestamp,
          "token=" + encodeURIComponent(c15Token)
        ];
        var btnStyle = "display:inline-block;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:6px;margin:0 4px 8px 4px;";
        var buttonsHtml = "<a href='" + WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Lite' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Lite</a>";
        buttonsHtml += "<a href='" + WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Core' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Core</a>";
        if (maxMembership && maxMembership !== "N/A" && maxMembership !== "N/A (not applicable)") {
          buttonsHtml += "<a href='" + WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Max' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Max</a>";
        }
        buttonsHtml += "<a href='" + WEB_APP_URL + "?" + baseParams.join("&") + "&decision=No&serviceLevel=N/A' style='" + btnStyle + "background-color:#dc2626;'>✗ No thank you</a>";
        buttonsHtml += "<br><a href='" + WEB_APP_URL + "?" + baseParams.join("&") + "&decision=ExtraMeeting&serviceLevel=N/A' style='" + btnStyle + "background-color:#2563eb;margin-top:12px;'>Request Additional Meeting with Proactive Facilitator</a>";
        return "Dear " + clientFirst + ",<br><br>I wanted to follow up regarding your VFO Services membership decision. We sent you an email a few days ago with your options, but we haven't heard back from you yet.<br><br>For your convenience, here are your options again:<br><br><div style='text-align:center;margin:24px 0;'>" + buttonsHtml + "</div><b>Important: After clicking, please do not close or navigate away from the page — allow some time for it to fully load. This is how your response is confirmed and recorded.</b><br><br>If you have any questions that would help you decide, please don't hesitate to reach out to " + (pfName || "your Proactive Facilitator") + ".<br><br>We look forward to hearing from you.";
      },
      pfSubject: function(clientName) { return "Action Required: No Response — " + clientName + " Membership Decision"; },
      pfBody: function(clientName, clientRef, pfFirst) {
        return "Hi " + pfFirst + ",<br><br><b>" + clientName + "</b> (" + clientRef + ") has not responded to their membership decision email. A follow-up was sent but there has been no response.<br><br>Please reach out to them directly to determine if they wish to proceed.";
      }
    },
    {
      label: "C17 Agreement Signing",
      sentDateCol: COL.C17_FOLLOWUP_SENT_DATE,
      followUp1Col: COL.C17_FOLLOWUP1_SENT,
      followUp2Col: COL.C17_FOLLOWUP2_SENT,
      resolvedCheck: function(row) {
        var clientSigned = String(row[COL.C17_CLIENT_SIGNED - 1]).trim();
        return clientSigned === "Yes";
      },
      clientSubject: "Following Up — VFO Services Agreement",
      clientBody: function(clientFirst, pfName, row) {
        var boldSignDocId = String(row[COL.BOLDSIGN_DOC_ID - 1]).trim();
        var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
        var signingLink = "";
        if (boldSignDocId && clientEmail) {
          try {
            signingLink = getBoldSignSigningUrl(boldSignDocId, clientEmail) || "";
          } catch (err) {
            Logger.log("FollowUp: Could not get signing link: " + err.message);
          }
        }
        var signingHtml = "";
        if (signingLink) {
          signingHtml = '<br><br>For your convenience, here is your signing link again:<br><br><div style="text-align:center;margin:24px 0;"><a href="' + signingLink + '" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Review & Sign Agreement</a></div>';
        }
        return "Dear " + clientFirst + ",<br><br>I wanted to follow up regarding your VFO Services Membership Agreement. We sent you a signing link a few days ago, but it doesn't appear to have been completed yet." + signingHtml + "If you experienced any issues with the signing process, please don't hesitate to reach out to " + (pfName || "your Proactive Facilitator") + " and we will be happy to assist.<br><br>We look forward to getting started.";
      },
      pfSubject: function(clientName) { return "Action Required: No Signature — " + clientName + " Membership Agreement"; },
      pfBody: function(clientName, clientRef, pfFirst) {
        return "Hi " + pfFirst + ",<br><br><b>" + clientName + "</b> (" + clientRef + ") has not signed their VFO Services Membership Agreement. A follow-up was sent but there has been no response.<br><br>Please reach out to them directly to determine if they need assistance or have changed their mind.";
      }
    },
    {
      label: "Payment Link",
      sentDateCol: COL.PAY1_FOLLOWUP_SENT_DATE,
      followUp1Col: COL.PAY1_FOLLOWUP1_SENT,
      followUp2Col: COL.PAY1_FOLLOWUP2_SENT,
      resolvedCheck: function(row) {
        var pay1Status = String(row[COL.PAY1_STATUS - 1]).trim();
        return pay1Status === "succeeded" || pay1Status === "processing";
      },
      clientSubject: "Following Up — VFO Services Payment",
      clientBody: function(clientFirst, pfName, row) {
        var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";
        var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
        var checkoutToken = String(row[COL.CHECKOUT_TOKEN - 1]).trim();
        var paymentUrl = WEB_APP_URL + "?action=stripepay&clientRef=" + encodeURIComponent(clientRef) + "&token=" + encodeURIComponent(checkoutToken);
        return "Dear " + clientFirst + ",<br><br>I wanted to follow up regarding your VFO Services membership payment. We sent you a secure payment link a few days ago, but it doesn't appear to have been completed yet.<br><br>For your convenience, here is your payment link again:<br><br><div style='text-align:center;margin:24px 0;'><a href='" + paymentUrl + "' style='display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;'>Complete Payment</a></div>If you experienced any issues with the payment process, please don't hesitate to reach out to " + (pfName || "your Proactive Facilitator") + " and we will be happy to assist.<br><br>We look forward to getting started on your planning priorities.";
      },
      pfSubject: function(clientName) { return "Action Required: No Payment — " + clientName + " Membership Payment"; },
      pfBody: function(clientName, clientRef, pfFirst) {
        return "Hi " + pfFirst + ",<br><br><b>" + clientName + "</b> (" + clientRef + ") has not completed their membership payment. A follow-up was sent but there has been no response.<br><br>Please reach out to them directly to determine if they need assistance or have changed their mind.";
      }
    }
  ];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    if (!clientRef) continue;

    var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
    var clientName = clientFirst + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
    var memberEmail = String(row[COL.MEMBER_EMAIL - 1]).trim();
    var pfName = String(row[COL.PF - 1]).trim();
    var sheetRow = i + 2;

    for (var f = 0; f < followUpConfigs.length; f++) {
      var cfg = followUpConfigs[f];

      var sentDateVal = row[cfg.sentDateCol - 1];
      if (!sentDateVal) continue;

      var sentDate = sentDateVal instanceof Date ? sentDateVal : new Date(sentDateVal);
      if (isNaN(sentDate.getTime())) continue;

      if (cfg.resolvedCheck(row)) continue;

      var followUp1 = String(row[cfg.followUp1Col - 1]).trim();
      var followUp2 = String(row[cfg.followUp2Col - 1]).trim();
      var daysSinceSent = (now - sentDate) / (1000 * 60 * 60 * 24);

      if (!followUp1 && daysSinceSent >= 3) {
        try {
          var pfEmail = getPFEmail(pfName);
          var extraCcFu = String(row[COL.EXTRA_CC - 1]).trim();
          var ccList = [memberEmail, pfEmail].filter(function(e) { return e && e !== ""; });
          if (extraCcFu) {
            var extraPartsFu = extraCcFu.split(",");
            for (var ecf = 0; ecf < extraPartsFu.length; ecf++) {
              var trimmedEcf = extraPartsFu[ecf].trim();
              if (trimmedEcf) ccList.push(trimmedEcf);
            }
          }
          var uniqueCc = ccList.filter(function(v, i, a) { return a.indexOf(v) === i; });
          GmailApp.createDraft(clientEmail, cfg.clientSubject, "", {
            htmlBody: cfg.clientBody(clientFirst, pfName, row) + signature,
            cc: uniqueCc.join(","),
            bcc: "aanderson@elitert.com,platham@elitert.com",
            name: "VFO Services"
          });
          pipeline.getRange(sheetRow, cfg.followUp1Col).setValue("Yes");
          Logger.log("FollowUp: " + cfg.label + " follow-up 1 draft created for " + clientName);
        } catch (err) {
          Logger.log("FollowUp: Error creating " + cfg.label + " follow-up 1: " + err.message);
        }
      }

      if (followUp1 === "Yes" && !followUp2 && daysSinceSent >= 6) {
        try {
          var pfEmail2 = getPFEmail(pfName);
          if (pfEmail2) {
            var pfFirst = pfName.split(" ")[0];
            GmailApp.createDraft(pfEmail2, cfg.pfSubject(clientName), "", {
              htmlBody: cfg.pfBody(clientName, clientRef, pfFirst) + signature,
              bcc: "aanderson@elitert.com,platham@elitert.com",
              name: "VFO Services"
            });
            pipeline.getRange(sheetRow, cfg.followUp2Col).setValue("Yes");
            Logger.log("FollowUp: " + cfg.label + " follow-up 2 (PF) draft created for " + clientName + " → " + pfName);
          }
        } catch (err) {
          Logger.log("FollowUp: Error creating " + cfg.label + " follow-up 2: " + err.message);
        }
      }
    }
  }

  Logger.log("sendFollowUpEmails complete");
}

function getDropboxAccessToken() {
  var refreshToken = PropertiesService.getScriptProperties().getProperty("DROPBOX_REFRESH_TOKEN");
  var appKey = PropertiesService.getScriptProperties().getProperty("DROPBOX_APP_KEY");
  var appSecret = PropertiesService.getScriptProperties().getProperty("DROPBOX_APP_SECRET");

  var response = UrlFetchApp.fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "post",
    payload: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    Logger.log("Dropbox token refresh failed: " + response.getContentText());
    return null;
  }

  var data = JSON.parse(response.getContentText());
  return data.access_token;
}

function createDropboxFileRequest(clientName, clientRef) {
  var token = getDropboxAccessToken();
  if (!token) {
    Logger.log("Dropbox: Could not get access token");
    return null;
  }

  // Create folder
  var folderPath = "/VFO Tax Documents/" + clientName + " (" + clientRef + ")";

  var folderResp = UrlFetchApp.fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({ path: folderPath, autorename: false }),
    muteHttpExceptions: true
  });

  var folderCode = folderResp.getResponseCode();
  if (folderCode !== 200 && folderCode !== 409) {
    Logger.log("Dropbox: Folder creation failed: " + folderResp.getContentText());
    return null;
  }
  Logger.log("Dropbox: Folder ready — " + folderPath);

  // Create file request
  var frResp = UrlFetchApp.fetch("https://api.dropboxapi.com/2/file_requests/create", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      title: "Tax Documents — " + clientName,
      destination: folderPath,
      open: true
    }),
    muteHttpExceptions: true
  });

  if (frResp.getResponseCode() !== 200) {
    Logger.log("Dropbox: File request creation failed: " + frResp.getContentText());
    return null;
  }

  var frData = JSON.parse(frResp.getContentText());
  Logger.log("Dropbox: File request created — " + frData.url);
  return frData.url;
}

// ============================================================
// C8.1 — SEND PENDING EMAILS (Timer)
// ============================================================

function sendPendingC8Emails() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var templateSheet = ss.getSheetByName("Email Templates");
  if (!templateSheet) return;

  var templateData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
  var templates = {};
  for (var t = 0; t < templateData.length; t++) {
    var sendStep = String(templateData[t][2]).trim();
    var condition = String(templateData[t][4]).trim();
    if (sendStep) {
      templates[sendStep + "|" + condition] = { subject: templateData[t][5] || "", body: templateData[t][6] || "" };
    }
  }

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var emailSent = String(row[COL.C81_EMAIL_SENT - 1]).trim();
    var decision = String(row[COL.C81_DECISION - 1]).trim();
    var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();

    if (emailSent !== "No") continue;
    if (!decision || decision === "") continue;
    if (!clientEmail || clientEmail === "") {
      Logger.log("C8.1: Skipping row " + (i + 2) + " — no client email");
      continue;
    }

    var templateKey = "C8.1|" + decision;
    var tmpl = templates[templateKey];
    if (!tmpl || !tmpl.body) { Logger.log("No template for " + templateKey); continue; }

    var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
    var clientName = clientFirst + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var memberName = row[COL.MEMBER_FIRST - 1] + " " + row[COL.MEMBER_LAST - 1];
    var memberEmail = String(row[COL.MEMBER_EMAIL - 1]).trim();
    var pfName = String(row[COL.PF - 1]).trim();
    var rawDate = row[COL.FOLLOWUP_MEETING_DATE - 1];
    var meetingDate = "";
    if (rawDate instanceof Date) {
      meetingDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "M/d/yyyy");
    } else {
      meetingDate = String(rawDate).trim();
    }

    var body = tmpl.body
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client First\]/g, clientFirst)
      .replace(/\[Member Name\]/g, memberName)
      .replace(/\[PF Name\]/g, pfName || "VFO Services Team")
      .replace(/\[Follow Up Meeting Date\]/g, meetingDate || "TBD");

    body = body + signature;

    var subject = tmpl.subject
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Member Name\]/g, memberName);

    var sheetRow = i + 2;

    try {
      var pfEmail = getPFEmail(String(row[COL.PF - 1]).trim());
      var ccList = [memberEmail, pfEmail].filter(function(e) { return e && e !== ""; });
      var uniqueCc = ccList.filter(function(v, i, a) { return a.indexOf(v) === i; });
      GmailApp.createDraft(clientEmail, subject, "", { htmlBody: body, cc: uniqueCc.join(","), bcc: "aanderson@elitert.com,platham@elitert.com" });
      pipeline.getRange(sheetRow, COL.C81_EMAIL_SENT).setValue("Yes");
      Logger.log("C8.1 " + decision + " draft created for: " + row[COL.CLIENT_REF - 1] + " " + clientName);
    } catch (err) {
      Logger.log("ERROR creating C8.1 draft: " + err.message);
    }
  }
}

// ============================================================
// C14 — SEND PENDING EMAILS (Timer)
// ============================================================

function sendPendingC14Emails() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var templateSheet = ss.getSheetByName("Email Templates");
  if (!templateSheet) { Logger.log("Email Templates sheet not found"); return; }

  var templateData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
  var templates = {};
  for (var t = 0; t < templateData.length; t++) {
    var sendStep = String(templateData[t][2]).trim();
    var condition = String(templateData[t][4]).trim();
    if (sendStep) {
      templates[sendStep + "|" + condition] = { subject: templateData[t][5] || "", body: templateData[t][6] || "" };
    }
  }

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var decision = String(row[COL.C13_DECISION - 1]).trim();
    var c14Sent = String(row[COL.C14_EMAIL_SENT - 1]).trim();
    var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();

    if ((decision !== "Undecided" && decision !== "No") || c14Sent !== "No") continue;
    if (!clientEmail || clientEmail === "NOT_FOUND" || clientEmail === "") continue;

    var tmpl = templates["C14|" + decision];
    if (!tmpl || !tmpl.body) { Logger.log("No template for: C14|" + decision); continue; }

    var sheetRow = i + 2;
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
    var clientLast = String(row[COL.CLIENT_LAST - 1]).trim();
    var memberFirst = String(row[COL.MEMBER_FIRST - 1]).trim();
    var memberLast = String(row[COL.MEMBER_LAST - 1]).trim();
    var memberEmail = String(row[COL.MEMBER_EMAIL - 1]).trim();
    var memberNum = String(row[COL.MEMBER_NUM - 1]).trim();
    var proactiveFacilitator = String(row[COL.PF - 1]).trim();
    var taxPlanner = String(row[COL.TAX_PLANNER - 1]).trim();
    var undecidedReason = String(row[COL.UNDECIDED_REASON - 1]).trim();
    var priorities = String(row[COL.CURRENT_PRIORITIES - 1]).trim();
    var liteMembership = row[COL.LITE_MEMBERSHIP - 1];
    var coreMembership = row[COL.CORE_MEMBERSHIP - 1];
    var maxMembership = row[COL.MAX_MEMBERSHIP - 1];
    var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();
    var clientName = clientFirst + " " + clientLast;
    var memberName = memberFirst + " " + memberLast;

    // Build agreement PDF attachments for Undecided emails
    var agreementAttachments = [];
    if (decision === "Undecided") {
      try {
        agreementAttachments.push(DriveApp.getFileById("1lMffuvtfjf_iQ17BNbzFhxtkE7CHr5qB").getBlob());
        agreementAttachments.push(DriveApp.getFileById("1BZIx-Qt6mZ4YE7avE97hzJmrw7ttd1aI").getBlob());
        var maxStr2 = String(maxMembership).trim();
        if (maxStr2 && maxStr2 !== "N/A" && maxStr2 !== "N/A (not applicable)") {
          agreementAttachments.push(DriveApp.getFileById("1c-faphbzJX1083WObDfO5WJ-S5DwndFx").getBlob());
        }
      } catch (err) {
        Logger.log("C14: Error loading agreement PDFs: " + err.message);
      }
    }

    var sentTimestamp = encodeURIComponent(new Date().toISOString());

    // Generate C15 token
    var c15Token = Utilities.getUuid();
    pipeline.getRange(sheetRow, COL.C15_TOKEN).setValue(c15Token);

    var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";

    var baseParams = [
      "action=c15",
      "clientRef=" + encodeURIComponent(clientRef),
      "clientFirst=" + encodeURIComponent(clientFirst),
      "clientLast=" + encodeURIComponent(clientLast),
      "clientEmail=" + encodeURIComponent(clientEmail),
      "memberNum=" + encodeURIComponent(memberNum),
      "ssId=" + encodeURIComponent(sourceSSID),
      "sent=" + sentTimestamp,
      "token=" + encodeURIComponent(c15Token)
    ];

    var buttonsHtml = "";
    if (decision === "Undecided") {
      var btnStyle = "display:inline-block;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:6px;margin:0 4px 8px 4px;";
      var liteBtnUrl = WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Lite";
      buttonsHtml += "<a href='" + liteBtnUrl + "' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Lite</a>";
      var coreBtnUrl = WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Core";
      buttonsHtml += "<a href='" + coreBtnUrl + "' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Core</a>";
      var maxStr = String(maxMembership).trim();
      if (maxStr && maxStr !== "N/A" && maxStr !== "N/A (not applicable)") {
        var maxBtnUrl = WEB_APP_URL + "?" + baseParams.join("&") + "&decision=Yes&serviceLevel=Max";
        buttonsHtml += "<a href='" + maxBtnUrl + "' style='" + btnStyle + "background-color:#16a34a;'>✓ Yes — Max</a>";
      }
      var noBtnUrl = WEB_APP_URL + "?" + baseParams.join("&") + "&decision=No&serviceLevel=N/A";
      buttonsHtml += "<a href='" + noBtnUrl + "' style='" + btnStyle + "background-color:#dc2626;'>✗ No thank you</a>";
      var extraMeetingUrl = WEB_APP_URL + "?" + baseParams.join("&") + "&decision=ExtraMeeting&serviceLevel=N/A";
      buttonsHtml += "<br><a href='" + extraMeetingUrl + "' style='" + btnStyle + "background-color:#2563eb;margin-top:12px;'> Request Additional Meeting with Proactive Facilitator</a>";
    }

    var priorityHtml = "";
    if (priorities && priorities !== "N/A") {
      var prioArray = priorities.split(",");
      for (var p = 0; p < prioArray.length; p++) {
        var trimmed = prioArray[p].trim();
        if (trimmed) priorityHtml += "<li>" + trimmed + "</li>";
      }
    }
    if (!priorityHtml) priorityHtml = "<li><span style='color:red;'>DETAIL</span></li>";

    var membershipHtml = "";
    if (decision === "Undecided") {
      if (liteMembership && String(liteMembership) !== "N/A") membershipHtml += "<li>Lite Membership: $" + formatDollar(liteMembership) + "</li>";
      if (coreMembership && String(coreMembership) !== "N/A") membershipHtml += "<li>Core Membership: $" + formatDollar(coreMembership) + "</li>";
      if (maxMembership && String(maxMembership) !== "N/A" && String(maxMembership) !== "N/A (not applicable)") membershipHtml += "<li>Max Membership: $" + formatDollar(maxMembership) + "</li>";
    }
    if (!membershipHtml) membershipHtml = "<li><span style='color:red;'>DETAIL</span></li>";

    var reasonText = "";
    if (undecidedReason === "Both" || undecidedReason === "Undecided whether to continue process") {
      reasonText = "whether to continue the process";
    } else if (undecidedReason === "Undecided which service level to choose") {
      reasonText = "as to which service level you want to choose";
    }

    var meetingAttendees = memberName + " and " + proactiveFacilitator;

    var body = tmpl.body
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client First\]/g, clientFirst)
      .replace(/\[Member Name\]/g, memberName)
      .replace(/\[Meeting Attendees\]/g, meetingAttendees)
      .replace(/\[Member &amp; VPF Names\]/g, meetingAttendees)
      .replace(/\[UNDECIDED_REASON\]/g, reasonText)
      .replace(/\[PRIORITIES\]/g, priorityHtml)
      .replace(/\[MEMBERSHIP_OPTIONS\]/g, membershipHtml)
      .replace(/\[BUTTONS\]/g, buttonsHtml)
      .replace(/\[PF Name\]/g, proactiveFacilitator || "VFO Services Team")
      .replace(/\[Coordinator Name\]/g, proactiveFacilitator || "VFO Services Team");

    body = body + signature;

    var subject = tmpl.subject
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Member Name\]/g, memberName);

    try {
      var pfEmail14 = getPFEmail(proactiveFacilitator);
      Logger.log("C14 DEBUG: row length=" + row.length + " EXTRA_CC index=" + (COL.EXTRA_CC - 1) + " raw value=" + JSON.stringify(row[COL.EXTRA_CC - 1]));
      var extraCc14 = String(row[COL.EXTRA_CC - 1]).trim();
      var ccList14 = [memberEmail, pfEmail14].filter(function(e) { return e && e !== ""; });
      if (extraCc14) {
        var extraParts14 = extraCc14.split(",");
        for (var ec = 0; ec < extraParts14.length; ec++) {
          var trimmedEc = extraParts14[ec].trim();
          if (trimmedEc) ccList14.push(trimmedEc);
        }
      }
      var uniqueCc14 = ccList14.filter(function(v, i, a) { return a.indexOf(v) === i; });
      var draftOptions14 = { htmlBody: body, cc: uniqueCc14.join(","), bcc: "aanderson@elitert.com,platham@elitert.com" };
      if (agreementAttachments.length > 0) {
        draftOptions14.attachments = agreementAttachments;
      }
      GmailApp.createDraft(clientEmail, subject, "", draftOptions14);
      pipeline.getRange(sheetRow, COL.C14_EMAIL_SENT).setValue("Yes");
      if (decision === "Undecided") {
        pipeline.getRange(sheetRow, COL.C14_FOLLOWUP_SENT_DATE).setValue(new Date());
      }
      Logger.log("C14 draft created for: " + clientRef + " " + clientName + " (" + decision + ") | token: " + c15Token);

      // Update Client Tracking G37
      if (sourceSSID) {
        try {
          var sourceSS = SpreadsheetApp.openById(sourceSSID);
          var allSheets = sourceSS.getSheets();
          for (var s = 0; s < allSheets.length; s++) {
            var sht = allSheets[s];
            try {
              if (String(sht.getRange("AB1").getValue()).trim() === "Client Tracking" &&
                  String(sht.getRange("A2").getValue()).trim() === String(clientRef).trim()) {
                sht.getRange("G37").setValue("Completed");
                sht.getRange("H37").setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/dd/yyyy"));
                if (decision === "No") {
                  sht.getRange("G38").setValue("No");
                  sht.getRange("H38").setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/dd/yyyy"));
                }
                Logger.log("C14: G37=Completed" + (decision === "No" ? " + G38=No" : "") + " for " + clientRef);
                break;
              }
            } catch (err) {}
          }
        } catch (err) {
          Logger.log("Could not update Client Tracking C14: " + err.message);
        }
      }

    } catch (err) {
      Logger.log("ERROR creating C14 draft for " + clientRef + ": " + err.message);
    }
  }
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

  var contributionNote = "";
  var memberContrib = parseFloat(String(clientData.memberContribution || "0").replace(/[,$]/g, "")) || 0;
  if (memberContrib > 0) {
    contributionNote = " (after member contribution of $" + formatMoney(memberContrib) + ")";
  }

  html = html
    .replace(/\[CLIENT_NAME\]/g, clientData.clientName || "")
    .replace(/\[CLIENT_EMAIL\]/g, clientData.clientEmail || "")
    .replace(/\[ANNUAL_FEE\]/g, clientData.annualFee || "")
    .replace(/\[CONTRIBUTION_NOTE\]/g, contributionNote)
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
// PF PRICING FORM REMINDER (Daily)
// ============================================================

function sendPFPricingReminder() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var c14Sent = String(row[COL.C14_EMAIL_SENT - 1]).trim();

    if (c14Sent !== "PF Pricing Sent") continue;

    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
    var clientLast = String(row[COL.CLIENT_LAST - 1]).trim();
    var clientName = clientFirst + " " + clientLast;
    var memberFirst = String(row[COL.MEMBER_FIRST - 1]).trim();
    var memberLast = String(row[COL.MEMBER_LAST - 1]).trim();
    var pfName = String(row[COL.PF - 1]).trim();
    var serviceLevel = String(row[COL.C15_SERVICE_LEVEL - 1]).trim();

    var pfEmail = getPFEmail(pfName);

    if (!pfEmail) {
      Logger.log("PFReminder: No PF email for " + pfName);
      continue;
    }

    var formUrl = WEB_APP_URL
      + "?action=c15yesform"
      + "&clientRef=" + encodeURIComponent(clientRef)
      + "&clientFirst=" + encodeURIComponent(clientFirst)
      + "&clientLast=" + encodeURIComponent(clientLast)
      + "&memberFirst=" + encodeURIComponent(memberFirst)
      + "&memberLast=" + encodeURIComponent(memberLast)
      + "&serviceLevel=" + encodeURIComponent(serviceLevel);

    var emailBody = '<p>Hi ' + pfName.split(" ")[0] + ',</p>'
      + '<p>This is a reminder that the pricing details for <b>' + clientName + '</b> (' + clientRef + ') are still outstanding.</p>'
      + '<p><b>Service Level:</b> ' + serviceLevel + '</p>'
      + '<p>Please complete the pricing form at your earliest convenience so the engagement letter can be generated:</p>'
      + '<p style="margin: 24px 0;"><a href="' + formUrl + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Complete Pricing Details</a></p>'
      + '<p style="color:#64748b;font-size:13px;">The pipeline cannot progress until this form is submitted.</p>';

    try {
      GmailApp.createDraft(pfEmail, "Reminder: Pricing Still Required — " + clientName + " (" + clientRef + ")", "", {
        htmlBody: emailBody + signature,
        cc: "jlatham@elitert.com"
      });
      Logger.log("PFReminder: Draft created for " + pfName + " re " + clientName);
    } catch (err) {
      Logger.log("PFReminder: Error creating draft: " + err.message);
    }
  }
}

// ============================================================
// C16/C17/C18 — SEND ENGAGEMENT & COUNTERSIGN EMAILS (Timer)
// ============================================================

function sendPendingC16C17C18Emails() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var sheetRow = i + 2;

    var c13Decision = String(row[COL.C13_DECISION - 1]).trim();
    var c14Sent = String(row[COL.C14_EMAIL_SENT - 1]).trim();
    var c15Decision = String(row[COL.C15_FINAL_DECISION - 1]).trim();
    var c16Sent = String(row[COL.C16_SENT - 1]).trim();
    var c17Signed = String(row[COL.C17_CLIENT_SIGNED - 1]).trim();
    var c18Signed = String(row[COL.C18_CEO_SIGNED - 1]).trim();
    var pay1Status = String(row[COL.PAY1_STATUS - 1]).trim();
    var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();

    // =============================================
    // PHASE 0A: Send PF Extra Meeting Decision Form
    // =============================================
    if (c14Sent === "Extra Meeting PF Needed") {
      var pfName0a = String(row[COL.PF - 1]).trim();
      var pfEmail0a = getPFEmail(pfName0a);
      if (!pfEmail0a) { Logger.log("Phase 0A: No PF email for " + pfName0a); continue; }

      var clientRef0a = String(row[COL.CLIENT_REF - 1]).trim();
      var clientFirst0a = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientLast0a = String(row[COL.CLIENT_LAST - 1]).trim();
      var memberFirst0a = String(row[COL.MEMBER_FIRST - 1]).trim();
      var memberLast0a = String(row[COL.MEMBER_LAST - 1]).trim();
      var clientName0a = clientFirst0a + " " + clientLast0a;

      var formUrl0a = WEB_APP_URL
        + "?action=c15extrameeting"
        + "&clientRef=" + encodeURIComponent(clientRef0a)
        + "&clientFirst=" + encodeURIComponent(clientFirst0a)
        + "&clientLast=" + encodeURIComponent(clientLast0a)
        + "&memberFirst=" + encodeURIComponent(memberFirst0a)
        + "&memberLast=" + encodeURIComponent(memberLast0a);

      var emailBody0a = '<p>Hi ' + pfName0a.split(" ")[0] + ',</p>'
        + '<p><b>' + clientName0a + '</b> (' + clientRef0a + ') is undecided and has requested an additional meeting to help them decide.</p>'
        + '<p>Once the meeting has been completed, please fill out the form below to indicate their decision:</p>'
        + '<p style="margin:24px 0;"><a href="' + formUrl0a + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Complete Decision Form</a></p>';

      try {
        GmailApp.createDraft(pfEmail0a, "Additional Meeting Requested — " + clientName0a + " (" + clientRef0a + ")", "", {
          htmlBody: emailBody0a + signature,
          cc: "lmorris@vfo-services.com",
          bcc: "aanderson@elitert.com,platham@elitert.com",
          name: "VFO Services"
        });
        pipeline.getRange(sheetRow, COL.C14_EMAIL_SENT).setValue("Extra Meeting PF Sent");
        Logger.log("Phase 0A: Extra meeting PF draft created for " + clientName0a + " → " + pfName0a);
      } catch (err) {
        Logger.log("Phase 0A error: " + err.message);
      }
      continue;
    }

    // =============================================
    // PHASE 0: Send PF Pricing Form (Undecided→Yes)
    // =============================================
    if (c14Sent === "PF Pricing Needed") {
      var pfName0 = String(row[COL.PF - 1]).trim();
      var pfEmail0 = getPFEmail(pfName0);
      if (!pfEmail0) { Logger.log("Phase 0: No PF email for " + pfName0); continue; }

      var clientRef0 = String(row[COL.CLIENT_REF - 1]).trim();
      var clientFirst0 = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientLast0 = String(row[COL.CLIENT_LAST - 1]).trim();
      var memberFirst0 = String(row[COL.MEMBER_FIRST - 1]).trim();
      var memberLast0 = String(row[COL.MEMBER_LAST - 1]).trim();
      var clientName0 = clientFirst0 + " " + clientLast0;
      var serviceLevel0 = String(row[COL.C15_SERVICE_LEVEL - 1]).trim();

      var formUrl0 = WEB_APP_URL
        + "?action=c15yesform"
        + "&clientRef=" + encodeURIComponent(clientRef0)
        + "&clientFirst=" + encodeURIComponent(clientFirst0)
        + "&clientLast=" + encodeURIComponent(clientLast0)
        + "&memberFirst=" + encodeURIComponent(memberFirst0)
        + "&memberLast=" + encodeURIComponent(memberLast0)
        + "&serviceLevel=" + encodeURIComponent(serviceLevel0);

      var emailBody0 = '<p>Hi ' + pfName0.split(" ")[0] + ',</p>'
        + '<p><b>' + clientName0 + '</b> has confirmed <b>Yes — ' + serviceLevel0 + '</b> from their follow-up email.</p>'
        + '<p>Please complete the pricing details so the engagement letter can be generated:</p>'
        + '<p style="margin: 24px 0;"><a href="' + formUrl0 + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Complete Pricing Details</a></p>'
        + '<p style="color:#64748b;font-size:13px;">Once submitted, the agreement will be generated and sent for signing automatically.</p>';

      try {
        GmailApp.createDraft(pfEmail0, "Action Required: Complete Pricing for " + clientName0 + " (" + serviceLevel0 + ")", "", { htmlBody: emailBody0 + signature });
        pipeline.getRange(sheetRow, COL.C14_EMAIL_SENT).setValue("PF Pricing Sent");
        Logger.log("Phase 0: PF pricing draft created for " + clientName0 + " → " + pfName0);
      } catch (err) {
        Logger.log("Phase 0 error: " + err.message);
      }
      continue;
    }

    // =============================================
    // PHASE 1: Generate PDF + Send to BoldSign + Create Client Email
    // Triggers: (C13=Yes OR C15=Yes), C16=No, C17=blank
    // Skip if still in PF pricing flow
    // =============================================
    var isYes = (c13Decision === "Yes" || c15Decision === "Yes");
    if (isYes && c16Sent === "No" && c17Signed === "" && c14Sent !== "PF Pricing Needed" && c14Sent !== "PF Pricing Sent") {
      if (!clientEmail) continue;

      Logger.log("Phase 1 triggered for row " + sheetRow);

      var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientLast = String(row[COL.CLIENT_LAST - 1]).trim();
      var clientName = clientFirst + " " + clientLast;
      var clientRef1 = String(row[COL.CLIENT_REF - 1]).trim();
      var memberFirst1 = String(row[COL.MEMBER_FIRST - 1]).trim();
      var memberLast1 = String(row[COL.MEMBER_LAST - 1]).trim();
      var memberName1 = memberFirst1 + " " + memberLast1;
      var memberEmail1 = String(row[COL.MEMBER_EMAIL - 1]).trim();
      var proactiveFacilitator1 = String(row[COL.PF - 1]).trim();
      var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var pipMeetingCount = String(row[COL.PIP_MEETING_COUNT - 1]).trim();
      var priorities = String(row[COL.CURRENT_PRIORITIES - 1]).trim();
      var parkedPriorities1 = String(row[COL.PARKED_PRIORITIES - 1]).trim();
      var grossFee = String(row[COL.GROSS_FEE - 1]).trim();
      var sourceSSID1 = String(row[COL.SOURCE_SS_ID - 1]).trim();

      var numPriorities = "0";
      if (priorities && priorities !== "N/A") {
        var prioArray = priorities.split(",");
        var count = 0;
        for (var pc = 0; pc < prioArray.length; pc++) {
          if (prioArray[pc].trim()) count++;
        }
        numPriorities = String(count);
      }

      var netInvoiceVal = String(row[COL.NET_INVOICE - 1]).trim();
      var annualFee = netInvoiceVal;
      var quarterlyFee = "";
      var initialPayment = "";
      if (netInvoiceVal && netInvoiceVal !== "N/A") {
        var feeNum = parseFloat(String(netInvoiceVal).replace(/[,$]/g, ""));
        if (!isNaN(feeNum)) {
          quarterlyFee = formatDollar(feeNum / 4);
          initialPayment = formatDollar(feeNum / 4);
          annualFee = formatDollar(feeNum);
        }
      }

      Logger.log("Generating PDF for: " + clientName + " | svc=" + serviceLevel + " | plan=" + paymentPlan + " | fee=" + grossFee);

      var result = null;
      try {
        var memberContribution1 = String(row[COL.MEMBER_CONTRIBUTION - 1]).trim();
        result = generateAgreementPDF({
          clientName: clientName,
          clientEmail: clientEmail,
          serviceLevel: serviceLevel,
          paymentPlan: paymentPlan || "Quarterly",
          annualFee: annualFee,
          quarterlyFee: quarterlyFee,
          initialPayment: initialPayment,
          numPriorities: numPriorities,
          numMeetings: pipMeetingCount,
          memberContribution: memberContribution1
        });
      } catch (err) {
        Logger.log("ERROR generating agreement PDF: " + err.message);
        continue;
      }

      if (!result || !result.blob || !result.templateId) {
        Logger.log("No PDF or template ID for " + clientName);
        continue;
      }

      var docId = null;
      try {
        docId = sendToBoldSign(result.blob, result.templateId, {
          clientName: clientName,
          clientEmail: clientEmail
        });
      } catch (err) {
        Logger.log("BoldSign error: " + err.message);
        continue;
      }

      if (docId) {
        pipeline.getRange(sheetRow, COL.BOLDSIGN_DOC_ID).setValue(docId);
        pipeline.getRange(sheetRow, COL.C16_SENT).setValue("Yes");
        pipeline.getRange(sheetRow, COL.C17_CLIENT_SIGNED).setValue("No");
        pipeline.getRange(sheetRow, COL.C18_CEO_SIGNED).setValue("No");
        Logger.log("BoldSign sent for " + clientName + " docId: " + docId);

        // Get client signing link and create email draft
        try {
          Utilities.sleep(3000);
          var clientSignLink1 = "";
          for (var attempt1 = 0; attempt1 < 3; attempt1++) {
            clientSignLink1 = getBoldSignSigningUrl(docId, clientEmail) || "";
            if (clientSignLink1) break;
            Logger.log("Signing link attempt " + (attempt1 + 1) + " failed, retrying in 3s...");
            Utilities.sleep(3000);
          }

          var templateSheet1 = ss.getSheetByName("Email Templates");
          if (templateSheet1) {
            var templateData1 = templateSheet1.getRange(2, 1, templateSheet1.getLastRow() - 1, 7).getValues();
            var templates1 = {};
            for (var t1 = 0; t1 < templateData1.length; t1++) {
              var sendStep1 = String(templateData1[t1][2]).trim();
              var condition1 = String(templateData1[t1][4]).trim();
              if (sendStep1) {
                templates1[sendStep1 + "|" + condition1] = { subject: templateData1[t1][5] || "", body: templateData1[t1][6] || "" };
              }
            }

            var tmpl1 = templates1["C16|Yes"];
            if (tmpl1 && tmpl1.body) {
              var priorityHtml1 = "";
              if (priorities && priorities !== "N/A") {
                var prioArr1 = priorities.split(",");
                for (var p1 = 0; p1 < prioArr1.length; p1++) {
                  var trimmed1 = prioArr1[p1].trim();
                  if (trimmed1) priorityHtml1 += "<li>" + trimmed1 + "</li>";
                }
              }
              if (!priorityHtml1) priorityHtml1 = "<li><span style='color:red;'>DETAIL</span></li>";

              var parkedHtml1 = "";
              if (parkedPriorities1 && parkedPriorities1 !== "N/A") {
                var parkArr1 = parkedPriorities1.split(",");
                for (var q1 = 0; q1 < parkArr1.length; q1++) {
                  var trimmed2 = parkArr1[q1].trim();
                  if (trimmed2) parkedHtml1 += "<li>" + trimmed2 + "</li>";
                }
              }
              if (!parkedHtml1) parkedHtml1 = "<li><span style='color:red;'>DETAIL</span></li>";

              var engagementHtml1 = "";
              if (clientSignLink1) {
                engagementHtml1 = '<a href="' + clientSignLink1 + '" style="color:#3b82f6; font-weight:bold;">click here to review and sign your agreement</a>';
              } else {
                engagementHtml1 = '<span style="color:red;">[ENGAGEMENT — signing link unavailable, run again]</span>';
              }

              var paymentLine1 = paymentPlan === "Quarterly"
                ? "Upon receipt of your first payment, Tracy Miller (VFO Liaison) will begin working on your planning priorities."
                : "Upon receipt of your payment, Tracy Miller (VFO Liaison) will begin working on your planning priorities.";

              var body1 = tmpl1.body
                .replace(/\[Client Name\]/g, clientName)
                .replace(/\[Client First\]/g, clientFirst)
                .replace(/\[Member Name\]/g, memberName1)
                .replace(/\[PF Name\]/g, proactiveFacilitator1 || "VFO Services Team")
                .replace(/\[Service Level\]/g, serviceLevel || "DETAIL")
                .replace(/\[PRIORITIES\]/g, priorityHtml1)
                .replace(/\[PARKED_PRIORITIES\]/g, parkedHtml1)
                .replace(/<span style="color:red;">\[ENGAGEMENT\]<\/span>/g, engagementHtml1)
                .replace(/\[ENGAGEMENT\]/g, engagementHtml1)
                .replace(/\[PAYMENT_LINE\]/g, paymentLine1);

              body1 = body1 + signature;

              var subject1 = tmpl1.subject
                .replace(/\[Client Name\]/g, clientName)
                .replace(/\[Member Name\]/g, memberName1);

              var pfEmail1 = getPFEmail(proactiveFacilitator1);
              var extraCc1 = String(row[COL.EXTRA_CC - 1]).trim();
              var ccList1 = [memberEmail1, pfEmail1].filter(function(e) { return e && e !== ""; });
              if (extraCc1) {
                var extraParts1 = extraCc1.split(",");
                for (var ec1 = 0; ec1 < extraParts1.length; ec1++) {
                  var trimmedEc1 = extraParts1[ec1].trim();
                  if (trimmedEc1) ccList1.push(trimmedEc1);
                }
              }
              var uniqueCc1 = ccList1.filter(function(v, i, a) { return a.indexOf(v) === i; });
              GmailApp.createDraft(clientEmail, subject1, "", { htmlBody: body1, cc: uniqueCc1.join(","), bcc: "aanderson@elitert.com,platham@elitert.com" });
              Logger.log("C16 client signing draft created for " + clientName);
              pipeline.getRange(sheetRow, COL.C17_FOLLOWUP_SENT_DATE).setValue(new Date());
            }
          }
        } catch (err) {
          Logger.log("Error creating client draft: " + err.message);
        }

        // Update Client Tracking G39
        if (sourceSSID1) {
          updateClientTrackingCell(sourceSSID1, clientRef1, "G39");
        }
      }
      continue;
    }

    // =============================================
    // PHASE 2: After Client signs, create CEO countersign email
    // Triggers: C17=Yes, C18=No
    // =============================================
    if (c17Signed === "Yes" && c18Signed === "No") {
      Logger.log("Phase 2 triggered for row " + sheetRow);

      var clientFirst2 = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientLast2 = String(row[COL.CLIENT_LAST - 1]).trim();
      var clientName2 = clientFirst2 + " " + clientLast2;
      var serviceLevel2 = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var grossFee2 = String(row[COL.GROSS_FEE - 1]).trim();
      var boldSignDocId2 = String(row[COL.BOLDSIGN_DOC_ID - 1]).trim();
      var ceoEmail = "aanderson@elitert.com";

      var annualFee2 = grossFee2;
      if (grossFee2 && grossFee2 !== "N/A") {
        var feeNum2 = parseFloat(String(grossFee2).replace(/[,$]/g, ""));
        if (!isNaN(feeNum2)) annualFee2 = formatDollar(feeNum2);
      }

      try {
        Utilities.sleep(3000);
        var ceoSignLink = "";
        for (var attempt2 = 0; attempt2 < 3; attempt2++) {
          ceoSignLink = getBoldSignSigningUrl(boldSignDocId2, ceoEmail) || "";
          if (ceoSignLink) break;
          Logger.log("CEO signing link attempt " + (attempt2 + 1) + " failed, retrying in 3s...");
          Utilities.sleep(3000);
        }

        if (ceoSignLink) {
          var ceoBody = '<p>Hi Anton,</p>'
            + '<p>A client has signed their VFO Membership Agreement and it is now ready for your countersignature:</p>'
            + '<p><b>Client:</b> ' + clientName2 + '<br>'
            + '<b>Service Level:</b> ' + serviceLevel2 + '<br>'
            + '<b>Annual Fee:</b> $' + annualFee2 + '</p>'
            + '<p><a href="' + ceoSignLink + '" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Countersign Agreement</a></p>';

          GmailApp.createDraft(ceoEmail, "Countersign: " + clientName2 + " - VFO Membership Agreement", "", { htmlBody: ceoBody, bcc: "platham@elitert.com" });
          pipeline.getRange(sheetRow, COL.C18_CEO_SIGNED).setValue("Pending");
          Logger.log("CEO countersign draft created for " + clientName2);
        } else {
          Logger.log("Could not get CEO signing link for " + clientName2);
        }
      } catch (err) {
        Logger.log("Error creating CEO countersign draft: " + err.message);
      }
      continue;
    }

    // =============================================
    // PHASE 3: After both signatures, generate payment link email
    // Triggers: C18=Yes, PAY1_STATUS=blank
    // =============================================
    if (c18Signed === "Yes" && pay1Status === "") {
      if (!clientEmail) continue;

      Logger.log("Phase 3 triggered for row " + sheetRow);

      var clientRef3 = String(row[COL.CLIENT_REF - 1]).trim();
      var clientFirst3 = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientLast3 = String(row[COL.CLIENT_LAST - 1]).trim();
      var clientName3 = clientFirst3 + " " + clientLast3;
      var memberEmail3 = String(row[COL.MEMBER_EMAIL - 1]).trim();
      var serviceLevel3 = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var paymentPlan3 = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var netInvoice3 = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;

      var paymentAmount3 = netInvoice3;
      if (paymentPlan3 === "Quarterly" && netInvoice3 > 0) {
        paymentAmount3 = netInvoice3 / 4;
      }
      var numPayments3 = paymentPlan3 === "Quarterly" ? "4" : "1";

      // Set intermediate status
      pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("Creating Checkout");
      SpreadsheetApp.flush();

      // Create Stripe Customer
      var customer3 = stripeRequest("customers", {
        "name": clientName3,
        "email": clientEmail,
        "metadata[client_ref]": clientRef3,
        "metadata[service_level]": serviceLevel3
      });

      if (!customer3 || !customer3.id) {
        Logger.log("Phase 3: Failed to create Stripe customer for " + clientName3);
        pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("error — customer creation failed");
        continue;
      }
      pipeline.getRange(sheetRow, COL.STRIPE_CUSTOMER_ID).setValue(customer3.id);
      Logger.log("Phase 3: Stripe customer created: " + customer3.id);

      // Generate checkout token
      var checkoutToken3 = Utilities.getUuid();
      pipeline.getRange(sheetRow, COL.CHECKOUT_TOKEN).setValue(checkoutToken3);

      // Build web app payment URL
      var paymentUrl3 = WEB_APP_URL
        + "?action=stripepay"
        + "&clientRef=" + encodeURIComponent(clientRef3)
        + "&token=" + encodeURIComponent(checkoutToken3);

      // Set PAY1_STATUS
      pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("Checkout Sent");
      pipeline.getRange(sheetRow, COL.PAY1_FOLLOWUP_SENT_DATE).setValue(new Date());
      pipeline.getRange(sheetRow, COL.PAY1_DATE).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy"));

      // Schedule quarterly payments if applicable
      if (paymentPlan3 === "Quarterly") {
        var today3 = new Date();
        var tz3 = Session.getScriptTimeZone();
        pipeline.getRange(sheetRow, COL.PAY2_STATUS).setValue("scheduled");
        pipeline.getRange(sheetRow, COL.PAY2_DATE).setValue(
          Utilities.formatDate(new Date(today3.getTime() + (91 * 24 * 60 * 60 * 1000)), tz3, "M/d/yyyy")
        );
        pipeline.getRange(sheetRow, COL.PAY3_STATUS).setValue("scheduled");
        pipeline.getRange(sheetRow, COL.PAY3_DATE).setValue(
          Utilities.formatDate(new Date(today3.getTime() + (182 * 24 * 60 * 60 * 1000)), tz3, "M/d/yyyy")
        );
        pipeline.getRange(sheetRow, COL.PAY4_STATUS).setValue("scheduled");
        pipeline.getRange(sheetRow, COL.PAY4_DATE).setValue(
          Utilities.formatDate(new Date(today3.getTime() + (273 * 24 * 60 * 60 * 1000)), tz3, "M/d/yyyy")
        );
      }

      // Create payment email draft
      var templateSheet3 = ss.getSheetByName("Email Templates");
      if (templateSheet3) {
        var templateData3 = templateSheet3.getRange(2, 1, templateSheet3.getLastRow() - 1, 7).getValues();
        var templates3 = {};
        for (var t3 = 0; t3 < templateData3.length; t3++) {
          var sendStep3 = String(templateData3[t3][2]).trim();
          var condition3 = String(templateData3[t3][4]).trim();
          if (sendStep3) {
            templates3[sendStep3 + "|" + condition3] = { subject: templateData3[t3][5] || "", body: templateData3[t3][6] || "" };
          }
        }

        var tmpl3 = templates3["C19|Payment"];
        if (tmpl3 && tmpl3.body) {
          var paymentLinkHtml = '<a href="' + paymentUrl3 + '" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Complete Payment — $' + formatMoney(paymentAmount3) + '</a>';

          var body3 = tmpl3.body
            .replace(/\[Client Name\]/g, clientName3)
            .replace(/\[Client First\]/g, clientFirst3)
            .replace(/\[Service Level\]/g, serviceLevel3)
            .replace(/\[Payment Amount\]/g, "$" + formatMoney(paymentAmount3))
            .replace(/\[X\]/g, "1")
            .replace(/\[Y\]/g, numPayments3)
            .replace(/\[PAYMENT_LINK\]/g, paymentLinkHtml);

          var subject3 = tmpl3.subject
            .replace(/\[Client Name\]/g, clientName3);

          try {
            var pfEmail3 = getPFEmail(String(row[COL.PF - 1]).trim());
            var extraCc3 = String(row[COL.EXTRA_CC - 1]).trim();
            var ccList3 = [memberEmail3, pfEmail3].filter(function(e) { return e && e !== ""; });
            if (extraCc3) {
              var extraParts3 = extraCc3.split(",");
              for (var ec3 = 0; ec3 < extraParts3.length; ec3++) {
                var trimmedEc3 = extraParts3[ec3].trim();
                if (trimmedEc3) ccList3.push(trimmedEc3);
              }
            }
            var uniqueCc3 = ccList3.filter(function(v, i, a) { return a.indexOf(v) === i; });
            GmailApp.createDraft(clientEmail, subject3, "", {
              htmlBody: body3 + signature,
              cc: uniqueCc3.join(","),
              bcc: "aanderson@elitert.com,platham@elitert.com",
              name: "VFO Services"
            });
            Logger.log("Phase 3: Payment email draft created for " + clientName3);
          } catch (err) {
            Logger.log("Phase 3: Error creating payment email draft: " + err.message);
          }
        } else {
          Logger.log("Phase 3: No template found for C19|Payment");
        }
      }

      continue;
    }
  }
}


// ============================================================
// C19 — STRIPE PAYMENT PROCESSING (Timer)
// ============================================================

var STRIPE_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "STRIPE_API_KEY_SANDBOX" : "STRIPE_API_KEY");

function stripeRequest(endpoint, params) {
  var url = "https://api.stripe.com/v1/" + endpoint;
  var headers = {
    "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":")
  };

  // Idempotency key goes in headers, not payload
  if (params && params.idempotency_key) {
    headers["Idempotency-Key"] = params.idempotency_key;
    delete params.idempotency_key;
  }

  var options = {
    method: "post",
    headers: headers,
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


function pollWebhookFallback() {
  var BOLDSIGN_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "BOLDSIGN_API_KEY_SANDBOX" : "BOLDSIGN_API_KEY");
  var STRIPE_API_KEY = PropertiesService.getScriptProperties().getProperty(MAP1_SANDBOX ? "STRIPE_API_KEY_SANDBOX" : "STRIPE_API_KEY");
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var sheetRow = i + 2;

    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    if (!clientRef) continue;

    var c16Sent = String(row[COL.C16_SENT - 1]).trim();
    var c17Signed = String(row[COL.C17_CLIENT_SIGNED - 1]).trim();
    var c18Signed = String(row[COL.C18_CEO_SIGNED - 1]).trim();
    var boldSignDocId = String(row[COL.BOLDSIGN_DOC_ID - 1]).trim();
    var pay1Status = String(row[COL.PAY1_STATUS - 1]).trim();
    var stripeCustomerId = String(row[COL.STRIPE_CUSTOMER_ID - 1]).trim();
    var stripeBankToken = String(row[COL.STRIPE_BANK_TOKEN - 1]).trim();
    var confirmStatus = String(row[COL.CONFIRMATION_STATUS - 1]).trim();
    var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();

    // =============================================
    // BOLDSIGN — Client signed (C17) and/or CEO signed (C18)
    // =============================================
    if (c16Sent === "Yes" && boldSignDocId && (c17Signed === "No" || c18Signed === "No" || c18Signed === "Pending")) {
      try {
        var bsUrl = "https://api.boldsign.com/v1/document/properties?documentId=" + boldSignDocId;
        var bsResp = UrlFetchApp.fetch(bsUrl, {
          method: "get",
          headers: { "X-API-KEY": BOLDSIGN_API_KEY, "accept": "application/json" },
          muteHttpExceptions: true
        });

        if (bsResp.getResponseCode() === 200) {
          var doc = JSON.parse(bsResp.getContentText());
          var docStatus = String(doc.status || "").toLowerCase();
          var signers = doc.signerDetails || [];
          var clientSigned = false;
          var ceoSigned = false;

          for (var s = 0; s < signers.length; s++) {
            var signerStatus = String(signers[s].status || "").toLowerCase();
            if (s === 0 && signerStatus === "completed") clientSigned = true;
            if (s === 1 && signerStatus === "completed") ceoSigned = true;
          }

          if (docStatus === "completed" || (clientSigned && ceoSigned)) {
            if (c17Signed === "No") {
              pipeline.getRange(sheetRow, COL.C17_CLIENT_SIGNED).setValue("Yes");
              updateClientTrackingCell(sourceSSID, clientRef, "G40");
            }
            if (c18Signed !== "Yes") {
              pipeline.getRange(sheetRow, COL.C18_CEO_SIGNED).setValue("Yes");
              updateClientTrackingCell(sourceSSID, clientRef, "G41");
            }
            Logger.log("Poller: Fully executed (both signed) for " + clientRef);
          } else if (clientSigned && c17Signed === "No") {
            pipeline.getRange(sheetRow, COL.C17_CLIENT_SIGNED).setValue("Yes");
            updateClientTrackingCell(sourceSSID, clientRef, "G40");
            Logger.log("Poller: Client signed recovered for " + clientRef);
          } else if (ceoSigned && c18Signed !== "Yes") {
            pipeline.getRange(sheetRow, COL.C18_CEO_SIGNED).setValue("Yes");
            updateClientTrackingCell(sourceSSID, clientRef, "G41");
            Logger.log("Poller: CEO signed recovered for " + clientRef);
          }
        }
      } catch (err) {
        Logger.log("Poller BoldSign error for " + clientRef + ": " + err.message);
      }
    }

    // =============================================
    // STRIPE — Checkout completed / payment status
    // =============================================
    if (stripeCustomerId && (pay1Status === "Checkout Sent" || pay1Status === "processing" || pay1Status === "requires_action")) {
      try {
        var sessResp = UrlFetchApp.fetch("https://api.stripe.com/v1/checkout/sessions?customer=" + stripeCustomerId + "&limit=1", {
          method: "get",
          headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
          muteHttpExceptions: true
        });

        var foundPI = false;
        if (sessResp.getResponseCode() === 200) {
          var sessData = JSON.parse(sessResp.getContentText());
          var sessions = sessData.data || [];

          if (sessions.length > 0 && sessions[0].status === "complete" && sessions[0].payment_intent) {
            foundPI = true;
            var piResp = UrlFetchApp.fetch("https://api.stripe.com/v1/payment_intents/" + sessions[0].payment_intent, {
              method: "get",
              headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
              muteHttpExceptions: true
            });

            if (piResp.getResponseCode() === 200) {
              var piData = JSON.parse(piResp.getContentText());
              var paymentMethodId = piData.payment_method || "";

              if (paymentMethodId && !stripeBankToken) {
                pipeline.getRange(sheetRow, COL.STRIPE_BANK_TOKEN).setValue(paymentMethodId);

                var pmResp = UrlFetchApp.fetch("https://api.stripe.com/v1/payment_methods/" + paymentMethodId, {
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
                    pipeline.getRange(sheetRow, COL.ACCT_LAST4).setValue(last4);
                  }
                }
                Logger.log("Poller: Payment method recovered for " + clientRef);
              }

              if (piData.status === "succeeded") {
                pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("succeeded");
                pipeline.getRange(sheetRow, COL.PAY1_DATE).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy"));
                pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
                pipeline.getRange(sheetRow, COL.REC1_STATUS).setValue("Receipt Needed");
                Logger.log("Poller: Payment 1 succeeded for " + clientRef);
              } else if (piData.status === "processing") {
                pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("processing");
                pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
                Logger.log("Poller: Payment 1 processing for " + clientRef);
              }
            }
          }
        }

        if (!foundPI) {
          var piListResp = UrlFetchApp.fetch("https://api.stripe.com/v1/payment_intents?customer=" + stripeCustomerId + "&limit=5", {
            method: "get",
            headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
            muteHttpExceptions: true
          });

          if (piListResp.getResponseCode() === 200) {
            var piListData = JSON.parse(piListResp.getContentText());
            var intents = piListData.data || [];

            for (var pi = 0; pi < intents.length; pi++) {
              var intent = intents[pi];
              var meta = intent.metadata || {};
              if (String(meta.client_ref || "").trim() !== clientRef) continue;
              if (String(meta.payment_number || "").trim() !== "1") continue;

              var pmId = intent.payment_method || "";
              if (pmId && !stripeBankToken) {
                pipeline.getRange(sheetRow, COL.STRIPE_BANK_TOKEN).setValue(pmId);

                var pmResp2 = UrlFetchApp.fetch("https://api.stripe.com/v1/payment_methods/" + pmId, {
                  method: "get",
                  headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
                  muteHttpExceptions: true
                });

                if (pmResp2.getResponseCode() === 200) {
                  var pmData2 = JSON.parse(pmResp2.getContentText());
                  var last4b = "";
                  if (pmData2.us_bank_account && pmData2.us_bank_account.last4) last4b = pmData2.us_bank_account.last4;
                  else if (pmData2.card && pmData2.card.last4) last4b = pmData2.card.last4;
                  if (last4b) pipeline.getRange(sheetRow, COL.ACCT_LAST4).setValue(last4b);
                }
                Logger.log("Poller: Payment method recovered (PI fallback) for " + clientRef);
              }

              if (intent.status === "succeeded") {
                pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("succeeded");
                pipeline.getRange(sheetRow, COL.PAY1_DATE).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy"));
                pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
                pipeline.getRange(sheetRow, COL.REC1_STATUS).setValue("Receipt Needed");
                Logger.log("Poller: Payment 1 succeeded (PI fallback) for " + clientRef);
              } else if (intent.status === "processing") {
                pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("processing");
                pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
                Logger.log("Poller: Payment 1 processing (PI fallback) for " + clientRef);
              } else if (intent.status === "requires_action") {
                pipeline.getRange(sheetRow, COL.PAY1_STATUS).setValue("requires_action");
                Logger.log("Poller: Payment 1 requires_action (PI fallback) for " + clientRef);
              }
              break;
            }
          }
        }
      } catch (err) {
        Logger.log("Poller Stripe error for " + clientRef + ": " + err.message);
      }
    }

    // =============================================
    // STRIPE — Quarterly payments 2-4 status
    // =============================================
    var quarterlyChecks = [
      { num: 2, statusCol: COL.PAY2_STATUS, dateCol: COL.PAY2_DATE },
      { num: 3, statusCol: COL.PAY3_STATUS, dateCol: COL.PAY3_DATE },
      { num: 4, statusCol: COL.PAY4_STATUS, dateCol: COL.PAY4_DATE }
    ];

    for (var q = 0; q < quarterlyChecks.length; q++) {
      var qc = quarterlyChecks[q];
      var qStatus = String(row[qc.statusCol - 1]).trim();

      if (qStatus === "Charging" || qStatus === "processing" || qStatus === "requires_action") {
        try {
          var qPiResp = UrlFetchApp.fetch("https://api.stripe.com/v1/payment_intents?customer=" + stripeCustomerId + "&limit=10", {
            method: "get",
            headers: { "Authorization": "Basic " + Utilities.base64Encode(STRIPE_API_KEY + ":") },
            muteHttpExceptions: true
          });

          if (qPiResp.getResponseCode() === 200) {
            var qPiData = JSON.parse(qPiResp.getContentText());
            var qIntents = qPiData.data || [];

            for (var qi = 0; qi < qIntents.length; qi++) {
              var qIntent = qIntents[qi];
              var qMeta = qIntent.metadata || {};
              if (String(qMeta.client_ref || "").trim() !== clientRef) continue;
              if (String(qMeta.payment_number || "").trim() !== String(qc.num)) continue;

              if (qIntent.status === "succeeded") {
                pipeline.getRange(sheetRow, qc.statusCol).setValue("succeeded");
                pipeline.getRange(sheetRow, qc.dateCol).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "M/d/yyyy"));
                pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
                Logger.log("Poller: Payment " + qc.num + " succeeded for " + clientRef);
              } else if (qIntent.status === "canceled" || qIntent.status === "failed") {
                pipeline.getRange(sheetRow, qc.statusCol).setValue("failed");
                Logger.log("Poller: Payment " + qc.num + " failed for " + clientRef);
              }
              break;
            }
          }
        } catch (err) {
          Logger.log("Poller Stripe payment " + qc.num + " error for " + clientRef + ": " + err.message);
        }
      }
    }
  }

  Logger.log("pollWebhookFallback complete");
}

function processQuarterlyPayments() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("C19 Payments: Could not acquire lock — another instance is running");
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = ss.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return;

    var lastRow = pipeline.getLastRow();
    if (lastRow < 2) return;
    var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var sheetRow = i + 2;

      // Payment 1 is handled by Stripe Checkout (Phase 3 of sendPendingC16C17C18Emails)
      // This function only handles quarterly payments 2, 3, 4

      var stripeCustomerId = String(row[COL.STRIPE_CUSTOMER_ID - 1]).trim();
      var stripeBankId = String(row[COL.STRIPE_BANK_TOKEN - 1]).trim();
      if (!stripeCustomerId || !stripeBankId) continue;

      var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
      var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
      var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var netInvoice = String(row[COL.NET_INVOICE - 1]).trim();
      if (paymentPlan !== "Quarterly") continue;

      var totalClientFee = parseFloat(String(netInvoice).replace(/[,$]/g, "")) || 0;
      var paymentAmount = totalClientFee / 4;

      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var tz = Session.getScriptTimeZone();

      var quarterlyPayments = [
        { num: 2, statusCol: COL.PAY2_STATUS, dateCol: COL.PAY2_DATE },
        { num: 3, statusCol: COL.PAY3_STATUS, dateCol: COL.PAY3_DATE },
        { num: 4, statusCol: COL.PAY4_STATUS, dateCol: COL.PAY4_DATE }
      ];

      for (var q = 0; q < quarterlyPayments.length; q++) {
        var qp = quarterlyPayments[q];
        var qStatus = String(row[qp.statusCol - 1]).trim();
        var qDateStr = String(row[qp.dateCol - 1]).trim();

        if (qStatus !== "scheduled" || !qDateStr) continue;

        var qDate = new Date(qDateStr);
        qDate.setHours(0, 0, 0, 0);
        if (today < qDate) continue;

        // Set intermediate status
        pipeline.getRange(sheetRow, qp.statusCol).setValue("Charging");
        SpreadsheetApp.flush();

        var paymentMethodType = String(row[COL.PAYMENT_METHOD_TYPE - 1]).trim();
        var chargeAmount = paymentAmount;
        var cardFee = 0;
        if (paymentMethodType === "card") {
          cardFee = Math.round((paymentAmount * 0.029 + 0.30) * 100) / 100;
          chargeAmount = Math.round((paymentAmount + cardFee) * 100) / 100;
        }

        var methodTypes = paymentMethodType === "card" ? "card" : "us_bank_account";
        var idempotencyKey = clientRef + "-pay" + qp.num + "-" + Utilities.formatDate(new Date(), tz, "yyyyMMddHHmmss");

        var chargeParams = {
          "amount": String(Math.round(chargeAmount * 100)),
          "currency": "usd",
          "customer": stripeCustomerId,
          "payment_method": stripeBankId,
          "payment_method_types[]": methodTypes,
          "confirm": "true",
          "description": "VFO Services — " + serviceLevel + " (Payment " + qp.num + " of 4)" + (paymentMethodType === "card" ? " (incl. $" + formatMoney(cardFee) + " card fee)" : ""),
          "metadata[client_ref]": clientRef,
          "metadata[payment_number]": String(qp.num),
          "metadata[payment_method_type]": paymentMethodType || "ach",
          "metadata[card_fee]": String(cardFee),
          "idempotency_key": idempotencyKey
        };

        if (paymentMethodType !== "card") {
          chargeParams["mandate_data[customer_acceptance][type]"] = "offline";
        }

        var charge = stripeRequest("payment_intents", chargeParams);

        if (charge && charge.id) {
          pipeline.getRange(sheetRow, qp.statusCol).setValue(charge.status || "pending");
          pipeline.getRange(sheetRow, qp.dateCol).setValue(Utilities.formatDate(new Date(), tz, "M/d/yyyy"));
          if (paymentMethodType === "card" && cardFee > 0) {
            var existingFee = parseFloat(String(row[COL.CARD_PROCESSING_FEE - 1]).replace(/[,$]/g, "")) || 0;
            pipeline.getRange(sheetRow, COL.CARD_PROCESSING_FEE).setValue(existingFee + cardFee);
          }
          if (charge.status === "succeeded") {
            pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Needed");
          }
        } else {
          pipeline.getRange(sheetRow, qp.statusCol).setValue("failed");
          pipeline.getRange(sheetRow, qp.dateCol).setValue(Utilities.formatDate(new Date(), tz, "M/d/yyyy"));
        }
        Logger.log("C19: Payment " + qp.num + " — " + (charge ? charge.status : "failed") + " for " + clientName + (cardFee > 0 ? " | card fee: $" + formatMoney(cardFee) : ""));
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// C19 Failed Payment
// ============================================================

function processFailedPaymentRetry() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("FailedRetry: Could not acquire lock — another instance is running");
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = ss.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return;

    var lastRow = pipeline.getLastRow();
    if (lastRow < 2) return;
    var data = pipeline.getRange(2, 1, lastRow - 1, COL.SOURCE_SHEET_NAME).getValues();

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var tz = Session.getScriptTimeZone();

    var payCols = [
      { num: 1, status: COL.PAY1_STATUS, date: COL.PAY1_DATE },
      { num: 2, status: COL.PAY2_STATUS, date: COL.PAY2_DATE },
      { num: 3, status: COL.PAY3_STATUS, date: COL.PAY3_DATE },
      { num: 4, status: COL.PAY4_STATUS, date: COL.PAY4_DATE }
    ];

    var templateSheet = ss.getSheetByName("Email Templates");
    var failedSubject = "";
    var failedBody = "";
    if (templateSheet) {
      var tData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
      for (var t = 0; t < tData.length; t++) {
        if (String(tData[t][2]).trim() === "C21" && String(tData[t][4]).trim() === "Failed") {
          failedSubject = String(tData[t][5]).trim();
          failedBody = String(tData[t][6]).trim();
          break;
        }
      }
    }

    var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

    var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpyrCReUGerI6Z7wLr0GTGnFaExPbpSTFzfqDurQ-FGBinlqtSmMlJIj6ZNt9TOrK/exec";

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var sheetRow = i + 2;

      var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
      var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientName = clientFirst + " " + String(row[COL.CLIENT_LAST - 1]).trim();
      var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
      var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
      var pfName = String(row[COL.PF - 1]).trim();
      var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var netInvoice = String(row[COL.NET_INVOICE - 1]).trim();
      var totalClientFee = parseFloat(String(netInvoice).replace(/[,$]/g, "")) || 0;
      var paymentAmount = totalClientFee;
      if (paymentPlan === "Quarterly" && totalClientFee > 0) paymentAmount = totalClientFee / 4;

      for (var p = 0; p < payCols.length; p++) {
        var pc = payCols[p];
        var status = String(row[pc.status - 1]).trim();

        // === FIRST FAILURE: Silently schedule retry in 3 days ===
        if (status === "failed") {
          var retryDate = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
          var retryDateStr = Utilities.formatDate(retryDate, tz, "M/d/yyyy");

          pipeline.getRange(sheetRow, pc.status).setValue("retry_scheduled");
          pipeline.getRange(sheetRow, pc.date).setValue(retryDateStr);

          Logger.log("FailedRetry: Silent retry scheduled for " + clientName + " payment " + pc.num + " on " + retryDateStr);
          break;
        }

        // === RETRY: Charge again when date arrives ===
        if (status === "retry_scheduled") {
          var retryDateVal = row[pc.date - 1];
          var retryDue = null;
          if (retryDateVal instanceof Date) {
            retryDue = retryDateVal;
          } else if (retryDateVal) {
            retryDue = new Date(retryDateVal);
          }
          if (!retryDue || isNaN(retryDue.getTime())) continue;

          retryDue.setHours(0, 0, 0, 0);
          if (retryDue > today) continue;

          var stripeCustomerId = String(row[COL.STRIPE_CUSTOMER_ID - 1]).trim();
          var stripeBankId = String(row[COL.STRIPE_BANK_TOKEN - 1]).trim();
          if (!stripeCustomerId || !stripeBankId) continue;

          // Set intermediate status
          pipeline.getRange(sheetRow, pc.status).setValue("Retrying");
          SpreadsheetApp.flush();

          Logger.log("FailedRetry: Retrying payment " + pc.num + " for " + clientName);

          var amountCents = String(Math.round(paymentAmount * 100));
          var idempotencyKey = clientRef + "-retry-pay" + pc.num + "-" + Utilities.formatDate(new Date(), tz, "yyyyMMddHHmmss");

          var charge = stripeRequest("payment_intents", {
            "amount": amountCents,
            "currency": "usd",
            "customer": stripeCustomerId,
            "payment_method": stripeBankId,
            "payment_method_types[]": "us_bank_account",
            "confirm": "true",
            "mandate_data[customer_acceptance][type]": "offline",
            "description": "VFO Services — " + serviceLevel + " (Payment " + pc.num + " — Retry)",
            "metadata[client_ref]": clientRef,
            "metadata[payment_number]": String(pc.num),
            "idempotency_key": idempotencyKey
          });

          if (charge && charge.id && charge.status !== "failed") {
            pipeline.getRange(sheetRow, pc.status).setValue(charge.status || "processing");
            pipeline.getRange(sheetRow, pc.date).setValue(Utilities.formatDate(new Date(), tz, "M/d/yyyy"));
            Logger.log("FailedRetry: Retry submitted — " + (charge.status || "processing") + " for " + clientName);
          } else {
            // Second failure — escalate
            pipeline.getRange(sheetRow, pc.status).setValue("Manual Review");

            var totalPayments = paymentPlan === "Quarterly" ? "4" : "1";

            // Email client using C21/Failed template
            if (failedBody) {
              var clientSubject = failedSubject
                .replace(/\[Client Name\]/g, clientName);

              var clientBody = failedBody
                .replace(/\[Client Name\]/g, clientName)
                .replace(/\[Client First\]/g, clientFirst)
                .replace(/\[Payment Amount\]/g, "$" + formatMoney(paymentAmount))
                .replace(/\[Service Level\]/g, serviceLevel)
                .replace(/\[X\]/g, String(pc.num))
                .replace(/\[Y\]/g, totalPayments);

              try {
                GmailApp.createDraft(clientEmail, clientSubject, "", {
                  htmlBody: clientBody + signature,
                  bcc: "aanderson@elitert.com,platham@elitert.com",
                  name: "VFO Services"
                });
                Logger.log("FailedRetry: Client email draft created for " + clientName);
              } catch (err) {
                Logger.log("FailedRetry: Error creating client draft: " + err.message);
              }
            }

            // Generate bank token for secure form link
            var bankToken = Utilities.getUuid();
            pipeline.getRange(sheetRow, COL.BANK_TOKEN).setValue(bankToken);

            // Combined email to PF + Tracy with bank update form link
            var pfEmail = getPFEmail(pfName);

            var tracyEmail = "tnmiller@vfo-services.com";
            var teamTo = tracyEmail;
            if (pfEmail && pfEmail !== tracyEmail) {
              teamTo = tracyEmail + "," + pfEmail;
            } else if (pfEmail) {
              teamTo = pfEmail;
            }

            var bankUpdateUrl = WEB_APP_URL
              + "?action=bankupdate"
              + "&clientRef=" + encodeURIComponent(clientRef)
              + "&clientName=" + encodeURIComponent(clientName)
              + "&paymentNumber=" + String(pc.num)
              + "&token=" + encodeURIComponent(bankToken);

            var teamBody = "Hi Tracy & " + pfName.split(" ")[0] + ",<br><br>"
              + "A payment has <strong>failed twice</strong> and requires manual intervention:<br><br>"
              + "<ul>"
              + "<li><strong>Client:</strong> " + clientName + " (" + clientRef + ")</li>"
              + "<li><strong>Connected Member:</strong> " + memberName + "</li>"
              + "<li><strong>Payment:</strong> " + pc.num + " of " + totalPayments + "</li>"
              + "<li><strong>Amount:</strong> $" + formatMoney(paymentAmount) + "</li>"
              + "<li><strong>Service Level:</strong> " + serviceLevel + "</li>"
              + "</ul><br>"
              + "Please contact the client to resolve the payment issue. If they need to update their bank details, send them this link:<br><br>"
              + '<p><a href="' + bankUpdateUrl + '" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Update Bank Details Form</a></p>'
              + '<p style="color:#dc2626;font-size:12px;margin-top:8px;"><strong>Note:</strong> This link can only be used once. If a new link is needed, contact Jake.</p>';

            try {
              GmailApp.createDraft(teamTo, "URGENT: Payment Failed Twice — " + clientName + " (" + clientRef + ")", "", {
                htmlBody: teamBody + signature,
                bcc: "aanderson@elitert.com,platham@elitert.com",
                name: "VFO Services"
              });
              Logger.log("FailedRetry: Team escalation draft created for " + clientName + " | bankToken: " + bankToken);
            } catch (err) {
              Logger.log("FailedRetry: Error creating team draft: " + err.message);
            }

            Logger.log("FailedRetry: Second failure — escalated to Manual Review for " + clientName + " payment " + pc.num);
          }
          break;
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// C19 — PAYMENT CONFIRMATION EMAILS (Timer)
// ============================================================

function processC19Confirmations() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var templateSheet = ss.getSheetByName("Email Templates");
  var emailSubjectTemplate = "";
  var emailBodyTemplate = "";
  if (templateSheet) {
    var tData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
    for (var t = 0; t < tData.length; t++) {
      if (String(tData[t][2]).trim() === "C19" && String(tData[t][4]).trim() === "$") {
        emailSubjectTemplate = String(tData[t][5]).trim();
        emailBodyTemplate = String(tData[t][6]).trim();
        break;
      }
    }
  }

  if (!emailBodyTemplate) {
    Logger.log("C19 Confirm: No email template found for C19/$");
    return;
  }

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var confirmStatus = String(row[COL.CONFIRMATION_STATUS - 1]).trim();

    if (confirmStatus !== "Confirmation Needed") continue;

    var sheetRow = i + 2;
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
    var clientName = clientFirst + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
    var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
    var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
    var netInvoice = String(row[COL.NET_INVOICE - 1]).trim();
    var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();
    var memberContribution = parseFloat(String(row[COL.MEMBER_CONTRIBUTION - 1]).replace(/[,$]/g, "")) || 0;

    var totalClientFee = parseFloat(String(netInvoice).replace(/[,$]/g, "")) || 0;
    var paymentAmount = totalClientFee;
    if (paymentPlan === "Quarterly" && totalClientFee > 0) {
      paymentAmount = totalClientFee / 4;
    }

    var paymentNumber = 1;
    if (String(row[COL.PAY4_STATUS - 1]).trim().toLowerCase() === "succeeded") paymentNumber = 4;
    else if (String(row[COL.PAY3_STATUS - 1]).trim().toLowerCase() === "succeeded") paymentNumber = 3;
    else if (String(row[COL.PAY2_STATUS - 1]).trim().toLowerCase() === "succeeded") paymentNumber = 2;
    else paymentNumber = 1;

    var totalPayments = paymentPlan === "Quarterly" ? "4" : "1";

    var subject = emailSubjectTemplate
      .replace(/\[Client Name\]/g, clientName);

    var paymentMethodType = String(row[COL.PAYMENT_METHOD_TYPE - 1]).trim();
    var cardFee = paymentMethodType === "card" ? Math.round((paymentAmount * 0.029 + 0.30) * 100) / 100 : 0;
    var totalCharged = paymentMethodType === "card" ? paymentAmount + cardFee : paymentAmount;

    var processingTime = paymentMethodType === "card"
      ? "As you paid by card, your payment has been processed immediately. An invoice and receipt will follow shortly."
      : "As you paid via ACH bank transfer, please allow 2-4 business days for the funds to clear. An invoice and receipt will follow once the transfer is complete.";

    var cardFeeText = "";
    if (paymentMethodType === "card" && cardFee > 0) {
      cardFeeText = "<br><br>A card processing fee of $" + formatMoney(cardFee) + " (2.9% + $0.30) was applied. Total amount charged: $" + formatMoney(totalCharged) + ".";
    }

    var body = emailBodyTemplate
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client First\]/g, clientFirst)
      .replace(/\[Payment Amount\]/g, "$" + formatMoney(paymentAmount))
      .replace(/\[Service Level\]/g, serviceLevel)
      .replace(/\[X\]/g, String(paymentNumber))
      .replace(/\[Y\]/g, totalPayments)
      .replace(/\[PROCESSING_TIME\]/g, processingTime)
      .replace(/\[CARD_FEE_TEXT\]/g, cardFeeText);

    try {
      var pfName19 = String(row[COL.PF - 1]).trim();
      var pfEmail19 = getPFEmail(pfName19);
      var memberEmail19 = String(row[COL.MEMBER_EMAIL - 1]).trim();
      var extraCc19 = String(row[COL.EXTRA_CC - 1]).trim();
      var ccList19 = [memberEmail19, pfEmail19].filter(function(e) { return e && e !== ""; });
      if (extraCc19) {
        var extraParts19 = extraCc19.split(",");
        for (var ec19 = 0; ec19 < extraParts19.length; ec19++) {
          var trimmedEc19 = extraParts19[ec19].trim();
          if (trimmedEc19) ccList19.push(trimmedEc19);
        }
      }
      var uniqueCc19 = ccList19.filter(function(v, i, a) { return a.indexOf(v) === i; });
      GmailApp.createDraft(clientEmail, subject, "", {
        htmlBody: body + signature,
        cc: uniqueCc19.join(","),
        bcc: "aanderson@elitert.com,platham@elitert.com",
        name: "VFO Services"
      });
      Logger.log("C19 Confirm: Draft created for " + clientName + " — payment " + paymentNumber);
    } catch (err) {
      Logger.log("C19 Confirm: Error creating draft: " + err.message);
      continue;
    }

    if (sourceSSID) {
      updateClientTrackingCell(sourceSSID, clientRef, "G42");
    }

    pipeline.getRange(sheetRow, COL.CONFIRMATION_STATUS).setValue("Confirmation Sent");

    // Set member contribution status
    if (memberContribution > 0) {
      pipeline.getRange(sheetRow, COL.MEMBER_CONTRIB_STATUS).setValue("Pending");
    } else {
      pipeline.getRange(sheetRow, COL.MEMBER_CONTRIB_STATUS).setValue("N/A");
    }

    // Set N/A for payments 2-4 if one-time
    if (paymentPlan !== "Quarterly") {
      pipeline.getRange(sheetRow, COL.REC2_NUMBER).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC2_STATUS).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC2_DRIVE_ID).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC2_EMAIL_SENT).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC3_NUMBER).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC3_STATUS).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC3_DRIVE_ID).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC3_EMAIL_SENT).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC4_NUMBER).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC4_STATUS).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC4_DRIVE_ID).setValue("N/A");
      pipeline.getRange(sheetRow, COL.REC4_EMAIL_SENT).setValue("N/A");
    }
    Logger.log("C19 Confirm: Complete for " + clientName);
  }
}

// ============================================================
// C20/C21 — INVOICE & RECEIPT GENERATION & EMAILS (Timer)
// ============================================================

var RECEIPT_PARENT_FOLDER_ID = "1RDQzbgwuuY7I1gOzvZczV01ZHj4lVCwD";

function getOrCreateClientFolder(clientName, clientRef) {
  var parentFolder = DriveApp.getFolderById(RECEIPT_PARENT_FOLDER_ID);

  var clientFolderName = clientName + " (" + clientRef + ")";
  var childFolders = parentFolder.getFoldersByName(clientFolderName);
  var clientFolder;
  if (childFolders.hasNext()) {
    clientFolder = childFolders.next();
  } else {
    clientFolder = parentFolder.createFolder(clientFolderName);
  }

  return clientFolder;
}

function generateInvoiceHTML(data) {
  var isQuarterly = data.paymentPlan === "Quarterly";
  var totalPayments = isQuarterly ? 4 : 1;
  var hasContribution = (data.memberContribution || 0) > 0;
  var clientOwes = hasContribution ? (data.netInvoice || 0) : data.totalFee;
  var paymentAmount = isQuarterly ? clientOwes / 4 : clientOwes;
  var planLabel = isQuarterly ? "Quarterly (" + totalPayments + " payments)" : "One-Time Payment";
  var isCard = data.paymentMethodType === "card";
  var cardFee = parseFloat(data.cardProcessingFee) || 0;
  var amountCharged = isCard ? paymentAmount + cardFee : paymentAmount;

  var scheduleRows = "";
  for (var p = 1; p <= totalPayments; p++) {
    var status = "";
    var dateStr = "";
    if (p === 1) {
      status = '<span style="color:#16a34a;font-weight:600;">✓ Paid</span>';
      dateStr = data.pay1Date || data.invoiceDate;
    } else {
      dateStr = data["pay" + p + "Date"] || "";
      status = '<span style="color:#64748b;">Scheduled</span>';
    }
    scheduleRows += '<tr>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;' + (p % 2 === 0 ? 'background:#f8fafc;' : '') + '">Payment ' + p + ' of ' + totalPayments + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;' + (p % 2 === 0 ? 'background:#f8fafc;' : '') + '">' + dateStr + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;' + (p % 2 === 0 ? 'background:#f8fafc;' : '') + '">$' + formatMoney(paymentAmount) + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;' + (p % 2 === 0 ? 'background:#f8fafc;' : '') + '">' + (isCard ? '' : status) + '</td>'
      + '</tr>';
    if (p === 1 && isCard && cardFee > 0) {
      scheduleRows += '<tr>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;"></td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-style:italic;">Card Processing Fee (2.9% + $0.30)</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">$' + formatMoney(cardFee) + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"></td>'
        + '</tr>'
        + '<tr style="background:#f0f9ff;">'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:600;"></td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:600;">Total Charged</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:600;">$' + formatMoney(amountCharged) + '</td>'
        + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="color:#16a34a;font-weight:600;">✓ Paid</span></td>'
        + '</tr>';
    }
  }

  // Member contribution section — only shown if applicable
  var contributionHtml = "";
  if (hasContribution) {
    contributionHtml = ''
      + '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Gross Service Value</span><span style="font-weight:600;color:#1e293b;">$' + formatMoney(data.totalFee) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Member Contribution</span><span style="font-weight:600;color:#16a34a;">-$' + formatMoney(data.memberContribution) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:10px 0 6px;font-size:13px;border-top:1px solid #e2e8f0;margin-top:4px;"><span style="font-weight:600;color:#1e293b;">Net Amount Due</span><span style="font-weight:600;color:#1e293b;font-size:16px;">$' + formatMoney(clientOwes) + '</span></div>';
  } else {
    contributionHtml = ''
      + '<div style="display:flex;justify-content:space-between;padding:10px 0 6px;font-size:13px;border-top:1px solid #e2e8f0;margin-top:4px;"><span style="font-weight:600;color:#1e293b;">Total Annual Fee</span><span style="font-weight:600;color:#1e293b;font-size:16px;">$' + formatMoney(data.totalFee) + '</span></div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>'
    + '* { margin:0; padding:0; box-sizing:border-box; }'
    + 'body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; }'
    + '</style></head><body>'
    + '<div style="background:#00488d;color:white;padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start;">'
    +   '<div>'
    +     '<h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">INVOICE</h1>'
    +     '<p style="font-size:12px;opacity:0.8;margin-top:4px;">VFO Services</p>'
    +   '</div>'
    +   '<div style="text-align:right;">'
    +     '<div style="font-size:13px;font-weight:600;background:rgba(255,255,255,0.15);padding:4px 12px;border-radius:4px;display:inline-block;">' + data.invoiceNumber + '</div>'
    +     '<div style="font-size:11px;opacity:0.8;margin-top:6px;">Date: ' + data.invoiceDate + '</div>'
    +   '</div>'
    + '</div>'
    + '<div style="padding:32px 40px;">'
    +   '<div style="display:flex;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">'
    +     '<div>'
    +       '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00488d;margin-bottom:6px;">From</div>'
    +       '<div style="font-size:14px;font-weight:600;color:#1e293b;">VFO Services</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">Elite Resource Team</div>'
    +     '</div>'
    +     '<div style="text-align:right;">'
    +       '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00488d;margin-bottom:6px;">Bill To</div>'
    +       '<div style="font-size:14px;font-weight:600;color:#1e293b;">' + data.clientName + '</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">Ref: ' + data.clientRef + '</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + data.clientEmail + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">'
    +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00488d;margin-bottom:12px;">Engagement Details</div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Service Level</span><span style="font-weight:600;color:#1e293b;">' + data.serviceLevel + ' Membership</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Payment Plan</span><span style="font-weight:600;color:#1e293b;">' + planLabel + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">PIP Meetings</span><span style="font-weight:600;color:#1e293b;">' + data.pipMeetingCount + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Payment Method</span><span style="font-weight:600;color:#1e293b;">' + (isCard ? 'Credit/Debit Card' : (data.paymentMethodType === 'check' ? 'Check' : 'ACH Bank Transfer')) + '</span></div>'
    +     contributionHtml
    +   '</div>'
    +   '<div style="margin-bottom:24px;">'
    +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00488d;margin-bottom:12px;">Payment Schedule</div>'
    +     '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
    +       '<thead><tr>'
    +         '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Payment</th>'
    +         '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Due Date</th>'
    +         '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>'
    +         '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Status</th>'
    +       '</tr></thead>'
    +       '<tbody>' + scheduleRows + '</tbody>'
    +     '</table>'
    + (isCard && isQuarterly ? '<p style="color:#1e40af;font-size:11px;font-style:italic;margin-top:8px;">Note: A card processing fee of 2.9% + $0.30 will also apply to each scheduled payment.</p>' : '')
    +   '</div>'
    +   '<div style="background:#00488d;color:white;padding:16px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">'
    +     '<span style="font-size:13px;font-weight:600;">' + (hasContribution ? 'Total Due (After Member Contribution)' : 'Total Engagement Value') + '</span>'
    +     '<span style="font-size:22px;font-weight:700;">$' + formatMoney(clientOwes) + '</span>'
    +   '</div>'
    +   '<div style="font-size:11px;color:#94a3b8;text-align:center;padding-top:16px;border-top:1px solid #e2e8f0;">'
    +     'This invoice reflects the terms of the signed VFO Services Membership Engagement Agreement.<br>For questions, contact VFO Services.'
    +   '</div>'
    + '</div>'
    + '</body></html>';
}

function generateReceiptHTML(data) {
  var isQuarterly = data.paymentPlan === "Quarterly";
  var totalPayments = isQuarterly ? 4 : 1;
  var paymentAmount = parseFloat(data.paymentAmount) || 0;
  var planText = isQuarterly ? "Payment " + data.paymentNumber + " of 4 (Quarterly)" : "One-Time Payment";
  var lineDesc = isQuarterly ? "Payment " + data.paymentNumber + " of 4" : "Full Payment";

  var nextPaymentText = "N/A";
  if (isQuarterly && data.paymentNumber < 4) {
    nextPaymentText = data.nextPaymentDate || "See schedule";
  }
  if (isQuarterly && data.paymentNumber === 4) {
    nextPaymentText = "Final payment — complete";
  }

  var isCard = data.paymentMethodType === "card";
  var cardFee = parseFloat(data.cardFee) || 0;
  var totalCharged = isCard ? paymentAmount + cardFee : paymentAmount;
  var paymentMethodShort = isCard ? 'Card · ****' + data.acctLast4 : (data.paymentMethodType === 'check' ? 'Check' : 'ACH · ****' + data.acctLast4);
  var paymentMethodIcon = isCard ? 'Via Credit/Debit Card · ending ****' + data.acctLast4 : (data.paymentMethodType === 'check' ? 'Via Check' : 'Via ACH Bank Transfer · Account ending ****' + data.acctLast4);

  var cardFeeBreakdown = '';
  if (isCard && cardFee > 0) {
    cardFeeBreakdown = '<div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e40af;margin-bottom:10px;">Card Fee Breakdown</div>'
      + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#64748b;">' + data.serviceLevel + ' Membership (Payment ' + data.paymentNumber + ' of ' + totalPayments + ')</span><span style="font-weight:600;color:#1e293b;">$' + formatMoney(paymentAmount) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#64748b;">Card Processing Fee (2.9% + $0.30)</span><span style="font-weight:600;color:#1e293b;">$' + formatMoney(cardFee) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:13px;border-top:1px solid #bfdbfe;margin-top:4px;"><span style="font-weight:600;color:#1e40af;">Total Charged</span><span style="font-weight:700;color:#1e40af;font-size:15px;">$' + formatMoney(totalCharged) + '</span></div>'
      + '</div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>'
    + '* { margin:0; padding:0; box-sizing:border-box; }'
    + 'body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; }'
    + '</style></head><body>'
    + '<div style="background:#16a34a;color:white;padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start;">'
    +   '<div>'
    +     '<h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">RECEIPT</h1>'
    +     '<p style="font-size:12px;opacity:0.8;margin-top:4px;">VFO Services</p>'
    +   '</div>'
    +   '<div style="text-align:right;">'
    +     '<div style="font-size:13px;font-weight:600;background:rgba(255,255,255,0.15);padding:4px 12px;border-radius:4px;display:inline-block;">' + data.receiptId + '</div>'
    +     '<div style="font-size:11px;opacity:0.8;margin-top:6px;">Date: ' + data.receiptDate + '</div>'
    +   '</div>'
    + '</div>'
    + '<div style="padding:32px 40px;">'
    +   '<div style="display:flex;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">'
    +     '<div>'
    +       '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:6px;">From</div>'
    +       '<div style="font-size:14px;font-weight:600;color:#1e293b;">VFO Services</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">Elite Resource Team</div>'
    +     '</div>'
    +     '<div style="text-align:right;">'
    +       '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:6px;">Received From</div>'
    +       '<div style="font-size:14px;font-weight:600;color:#1e293b;">' + data.clientName + '</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">Ref: ' + data.clientRef + '</div>'
    +       '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + data.clientEmail + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:12px;margin-bottom:24px;">'
    +     '<div style="width:36px;height:36px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:700;">✓</div>'
    +     '<div>'
    +       '<div style="font-size:14px;font-weight:600;color:#166534;">Payment Successfully Received</div>'
    +       '<div style="font-size:12px;color:#4ade80;margin-top:2px;">' + paymentMethodIcon + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">'
    +     '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:12px;">Payment Details</div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Invoice Reference</span><span style="font-weight:600;color:#1e293b;">' + data.invoiceNumber + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Service</span><span style="font-weight:600;color:#1e293b;">VFO ' + data.serviceLevel + ' Membership</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Payment</span><span style="font-weight:600;color:#1e293b;">' + planText + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Payment Method</span><span style="font-weight:600;color:#1e293b;">' + paymentMethodShort + '</span></div>'
    +     '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Date Received</span><span style="font-weight:600;color:#1e293b;">' + data.receiptDate + '</span></div>'
    +   '</div>'
    +   '<div style="background:#16a34a;color:white;padding:16px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">'
    +     '<span style="font-size:13px;font-weight:600;">' + (isCard ? 'Total Charged (incl. card fee)' : 'Amount Received') + '</span>'
    +     '<span style="font-size:22px;font-weight:700;">$' + formatMoney(isCard ? totalCharged : paymentAmount) + '</span>'
    +   '</div>'
    +   cardFeeBreakdown
    + (isQuarterly && data.paymentNumber < 4
      ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;margin-bottom:24px;font-size:12px;color:#64748b;">'
      +   '<strong style="color:#334155;">Next Payment:</strong> $' + formatMoney(paymentAmount) + ' scheduled for ' + nextPaymentText
      +   (isCard ? '<br><span style="color:#1e40af;font-style:italic;">Note: A card processing fee of 2.9% + $0.30 will also apply.</span>' : '')
      + '</div>'
      : '')
    +   '<div style="font-size:11px;color:#94a3b8;text-align:center;padding-top:16px;border-top:1px solid #e2e8f0;">'
    +     'Thank you for your payment. This receipt confirms funds have been received.<br>For questions, contact VFO Services.'
    +   '</div>'
    + '</div>'
    + '</body></html>';
}

function processC20C21Receipts() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("C20/C21: Could not acquire lock — another instance is running");
    return;
  }

  try {
    var VFOS_SS_ID = "1M6AX-DKO9J-VesWQBD9hJjAJfy99IJLzechPl0UiyCM";
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = ss.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return;

    var lastRow = pipeline.getLastRow();
    if (lastRow < 2) return;
    var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

    var TAX_PRIORITIES = ["Income Tax", "Capital Gains Tax", "Retirement / Estate", "Charitable / Gift", "Business Tax", "Other (Tax Focus)", "Tax Planning (Income Tax Focus)", "Tax Planning (Capital Gain Tax Focus)", "Tax Planning (Retirement/Estate Tax Focus)", "Tax Planning (Charitable/Gift Tax Focus)", "Tax Planning (Business Tax Focus)", "Tax Planning"];

    var recCols = {
      1: { number: COL.REC1_NUMBER, status: COL.REC1_STATUS, driveId: COL.REC1_DRIVE_ID, emailSent: COL.REC1_EMAIL_SENT },
      2: { number: COL.REC2_NUMBER, status: COL.REC2_STATUS, driveId: COL.REC2_DRIVE_ID, emailSent: COL.REC2_EMAIL_SENT },
      3: { number: COL.REC3_NUMBER, status: COL.REC3_STATUS, driveId: COL.REC3_DRIVE_ID, emailSent: COL.REC3_EMAIL_SENT },
      4: { number: COL.REC4_NUMBER, status: COL.REC4_STATUS, driveId: COL.REC4_DRIVE_ID, emailSent: COL.REC4_EMAIL_SENT }
    };

    for (var i = 0; i < data.length; i++) {
      var row = data[i];

      var paymentNumber = 0;
      for (var pn = 1; pn <= 4; pn++) {
        var recStatus = String(row[recCols[pn].status - 1]).trim();
        if (recStatus === "Receipt Needed") {
          paymentNumber = pn;
          break;
        }
      }
      if (paymentNumber === 0) continue;

      var sheetRow = i + 2;

      // Set intermediate status to prevent duplicate processing
      pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Generating");
      SpreadsheetApp.flush();

      var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
      var clientFirst = String(row[COL.CLIENT_FIRST - 1]).trim();
      var clientName = clientFirst + " " + String(row[COL.CLIENT_LAST - 1]).trim();
      var clientEmail = String(row[COL.CLIENT_EMAIL - 1]).trim();
      var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var grossFee = parseFloat(String(row[COL.GROSS_FEE - 1]).replace(/[,$]/g, "")) || 0;
      var memberContribution = parseFloat(String(row[COL.MEMBER_CONTRIBUTION - 1]).replace(/[,$]/g, "")) || 0;
      var netInvoice = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;
      var paymentAmount = netInvoice;
      if (paymentPlan === "Quarterly" && netInvoice > 0) paymentAmount = netInvoice / 4;
      var acctLast4 = String(row[COL.ACCT_LAST4 - 1]).trim();
      var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();
      var pipMeetingCount = String(row[COL.PIP_MEETING_COUNT - 1]).trim();
      var tz = Session.getScriptTimeZone();
      var today = Utilities.formatDate(new Date(), tz, "MMMM d, yyyy");

      // === INVOICE (payment 1 only) ===
      var invoiceNumber = "";
      var invoiceFileId = "";
      if (paymentNumber === 1) {
        var vfosSS = SpreadsheetApp.openById(VFOS_SS_ID);
        var vfosSheet = vfosSS.getSheetByName("VFOS");
        if (vfosSheet) {
          var vfosLastRow = vfosSheet.getLastRow();
          var highestInvSeq = 0;
          if (vfosLastRow >= 2) {
            var vfosInvData = vfosSheet.getRange(2, 3, vfosLastRow - 1, 1).getValues();
            var invPrefix = "INV-" + clientRef + "-";
            for (var v = 0; v < vfosInvData.length; v++) {
              var invVal = String(vfosInvData[v][0]).trim();
              if (invVal.indexOf(invPrefix) === 0) {
                var invSeq = parseInt(invVal.replace(invPrefix, ""), 10) || 0;
                if (invSeq > highestInvSeq) highestInvSeq = invSeq;
              }
            }
          }
          var seqNum = String(highestInvSeq + 1);
          while (seqNum.length < 4) seqNum = "0" + seqNum;
          invoiceNumber = "INV-" + clientRef + "-" + seqNum;

          var newVfosRow = vfosLastRow + 1;
          vfosSheet.getRange(newVfosRow, 1, 1, 4).setValues([[clientRef, clientName, invoiceNumber, ""]]);
          SpreadsheetApp.flush();
          Logger.log("C20: Invoice row created on VFOS — " + invoiceNumber);
        }

        var pay1Date = today;
        var pay2Date = "", pay3Date = "", pay4Date = "";
        if (paymentPlan === "Quarterly") {
          var p2d = row[COL.PAY2_DATE - 1];
          var p3d = row[COL.PAY3_DATE - 1];
          var p4d = row[COL.PAY4_DATE - 1];
          if (p2d instanceof Date) pay2Date = Utilities.formatDate(p2d, tz, "MMMM d, yyyy"); else if (p2d) { var pd2 = new Date(p2d); if (!isNaN(pd2.getTime())) pay2Date = Utilities.formatDate(pd2, tz, "MMMM d, yyyy"); else pay2Date = String(p2d); }
          if (p3d instanceof Date) pay3Date = Utilities.formatDate(p3d, tz, "MMMM d, yyyy"); else if (p3d) { var pd3 = new Date(p3d); if (!isNaN(pd3.getTime())) pay3Date = Utilities.formatDate(pd3, tz, "MMMM d, yyyy"); else pay3Date = String(p3d); }
          if (p4d instanceof Date) pay4Date = Utilities.formatDate(p4d, tz, "MMMM d, yyyy"); else if (p4d) { var pd4 = new Date(p4d); if (!isNaN(pd4.getTime())) pay4Date = Utilities.formatDate(pd4, tz, "MMMM d, yyyy"); else pay4Date = String(p4d); }
        }

        var paymentMethodType = String(row[COL.PAYMENT_METHOD_TYPE - 1]).trim();
        var cardProcessingFee = parseFloat(String(row[COL.CARD_PROCESSING_FEE - 1]).replace(/[,$]/g, "")) || 0;

        var invoiceHtml = generateInvoiceHTML({
          invoiceNumber: invoiceNumber,
          invoiceDate: today,
          clientName: clientName,
          clientRef: clientRef,
          clientEmail: clientEmail,
          serviceLevel: serviceLevel,
          paymentPlan: paymentPlan,
          totalFee: grossFee,
          memberContribution: memberContribution,
          netInvoice: netInvoice,
          pipMeetingCount: pipMeetingCount,
          pay1Date: pay1Date,
          pay2Date: pay2Date,
          pay3Date: pay3Date,
          pay4Date: pay4Date,
          paymentMethodType: paymentMethodType,
          cardProcessingFee: cardProcessingFee
        });

        var invPdfResponse = UrlFetchApp.fetch("https://api.html2pdf.app/v1/generate", {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            html: invoiceHtml,
            apiKey: PropertiesService.getScriptProperties().getProperty("HTML2PDF_API_KEY"),
            format: "Letter",
            margin: 0
          }),
          muteHttpExceptions: true
        });
        if (invPdfResponse.getResponseCode() !== 200) {
          Logger.log("C20: Invoice PDF error: " + invPdfResponse.getContentText());
          pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Receipt Needed");
          continue;
        }
        var invPdfBlob = invPdfResponse.getBlob().setName(invoiceNumber + ".pdf");

        var clientFolder = getOrCreateClientFolder(clientName, clientRef);
        var invFile = clientFolder.createFile(invPdfBlob);
        invoiceFileId = invFile.getId();
        Logger.log("C20: Invoice PDF saved — " + invoiceNumber + " | File ID: " + invoiceFileId);

        pipeline.getRange(sheetRow, COL.INVOICE_NUMBER).setValue(invoiceNumber);
        pipeline.getRange(sheetRow, COL.INVOICE_DRIVE_ID).setValue(invoiceFileId);
      } else {
        invoiceNumber = String(row[COL.INVOICE_NUMBER - 1]).trim();
      }

      // === RECEIPT ===
      var highestRecSeq = 0;
      try {
        var vfosSS3 = SpreadsheetApp.openById(VFOS_SS_ID);
        var vfosSheet3 = vfosSS3.getSheetByName("VFOS");
        if (vfosSheet3 && vfosSheet3.getLastRow() >= 2) {
          var vfosRecData = vfosSheet3.getRange(2, 4, vfosSheet3.getLastRow() - 1, 1).getValues();
          var recPrefix = "REC-" + clientRef + "-";
          for (var rv = 0; rv < vfosRecData.length; rv++) {
            var recVal = String(vfosRecData[rv][0]).trim();
            if (recVal.indexOf(recPrefix) === 0) {
              var recSeq = parseInt(recVal.replace(recPrefix, ""), 10) || 0;
              if (recSeq > highestRecSeq) highestRecSeq = recSeq;
            }
          }
        }
      } catch (err) {
        Logger.log("C20: Could not scan VFOS for receipt seq: " + err.message);
      }
      var receiptSeqNum = String(highestRecSeq + 1);
      while (receiptSeqNum.length < 4) receiptSeqNum = "0" + receiptSeqNum;
      var receiptId = "REC-" + clientRef + "-" + receiptSeqNum;

      var nextPaymentDate = "";
      if (paymentPlan === "Quarterly" && paymentNumber < 4) {
        var nextDateCol = COL.PAY1_DATE + (paymentNumber * 2);
        var nd = row[nextDateCol - 1];
        if (nd instanceof Date) {
          nextPaymentDate = Utilities.formatDate(nd, tz, "MMMM d, yyyy");
        } else if (nd) {
          var parsed = new Date(nd);
          if (!isNaN(parsed.getTime())) {
            nextPaymentDate = Utilities.formatDate(parsed, tz, "MMMM d, yyyy");
          } else {
            nextPaymentDate = String(nd);
          }
        }
      }

      var paymentMethodType = String(row[COL.PAYMENT_METHOD_TYPE - 1]).trim();
      var cardFeeForReceipt = paymentMethodType === "card" ? Math.round((paymentAmount * 0.029 + 0.30) * 100) / 100 : 0;

      var receiptHtml = generateReceiptHTML({
        receiptId: receiptId,
        receiptDate: today,
        clientName: clientName,
        clientRef: clientRef,
        clientEmail: clientEmail,
        serviceLevel: serviceLevel,
        paymentPlan: paymentPlan,
        paymentAmount: paymentAmount,
        paymentNumber: paymentNumber,
        acctLast4: acctLast4,
        invoiceNumber: invoiceNumber,
        nextPaymentDate: nextPaymentDate,
        paymentMethodType: paymentMethodType,
        cardFee: cardFeeForReceipt
      });

      var recPdfResponse = UrlFetchApp.fetch("https://api.html2pdf.app/v1/generate", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          html: receiptHtml,
          apiKey: PropertiesService.getScriptProperties().getProperty("HTML2PDF_API_KEY"),
          format: "Letter",
          margin: 0
        }),
        muteHttpExceptions: true
      });
      if (recPdfResponse.getResponseCode() !== 200) {
        Logger.log("C20: Receipt PDF error: " + recPdfResponse.getContentText());
        pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Receipt Needed");
        continue;
      }
      var recPdfBlob = recPdfResponse.getBlob().setName(receiptId + ".pdf");

      var clientFolder2 = getOrCreateClientFolder(clientName, clientRef);
      var recFile = clientFolder2.createFile(recPdfBlob);
      var recFileId = recFile.getId();
      Logger.log("C20: Receipt PDF saved — " + receiptId + " | File ID: " + recFileId);

      // Update VFOS sheet — add receipt row
      try {
        var vfosSS2 = SpreadsheetApp.openById(VFOS_SS_ID);
        var vfosSheet2 = vfosSS2.getSheetByName("VFOS");
        if (vfosSheet2) {
          var vfosNewRow = vfosSheet2.getLastRow() + 1;
          vfosSheet2.getRange(vfosNewRow, 1, 1, 4).setValues([[clientRef, clientName, "", receiptId]]);
          Logger.log("C20: VFOS receipt row created — " + receiptId);
        }
      } catch (err) {
        Logger.log("C20: Could not update VFOS sheet: " + err.message);
      }

      // === EMAIL ===
      var emailSubject = "";
      var emailBody = "";
      var attachments = [];

      var templateSheet = ss.getSheetByName("Email Templates");
      if (templateSheet) {
        var tData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
        var templateKey = paymentNumber === 1 ? "First" : "Subsequent";
        for (var t = 0; t < tData.length; t++) {
          if (String(tData[t][2]).trim() === "C21" && String(tData[t][4]).trim() === templateKey) {
            emailSubject = String(tData[t][5]).trim();
            emailBody = String(tData[t][6]).trim();
            break;
          }
        }
      }

      if (!emailBody) {
        Logger.log("C21: No email template found for payment " + paymentNumber);
        pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Receipt Needed");
        continue;
      }

      // Build priority, specialist, and service level content for first payment
      var priorityHTML = "";
      var specialistIntro = "";
      var taxUploadText = "";
      var serviceLevelText = "";

      if (paymentNumber === 1) {
        var priorities = String(row[COL.CURRENT_PRIORITIES - 1]).trim();
        var hasTax = false;
        var hasRegular = false;

        if (priorities && priorities !== "N/A") {
          var parts = priorities.split(",");
          priorityHTML = "<ol>";
          for (var p = 0; p < parts.length; p++) {
            var pri = parts[p].trim();
            if (pri) {
              priorityHTML += "<li>" + pri + "</li>";
              if (TAX_PRIORITIES.indexOf(pri) !== -1) hasTax = true;
              else hasRegular = true;
            }
          }
          priorityHTML += "</ol>";
        }

        if (hasTax && hasRegular) {
          specialistIntro = "You will be introduced to the VFO Specialist and/or our Director of Advanced Tax Planning who will discuss your needs with you.";
        } else if (hasTax) {
          specialistIntro = "You will be introduced to our Director of Advanced Tax Planning who will discuss your needs with you.";
        } else {
          specialistIntro = "You will be introduced to the VFO Specialist who will discuss your needs with you.";
        }

        if (hasTax) {
          try {
            var dropboxUploadUrl = createDropboxFileRequest(clientName, clientRef);
            if (dropboxUploadUrl) {
              taxUploadText = "<br><br>On that note, we do need your tax returns. Please upload the last 3 years' returns using the secure link below:"
                + '<p style="margin:24px 0;"><a href="' + dropboxUploadUrl + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Upload Tax Documents</a></p>'
                + '<p style="color:#64748b;font-size:12px;margin-bottom:0;">Your files are sent directly to our secure document storage and are encrypted for your protection.</p>';
              Logger.log("C21: Dropbox upload link created for " + clientName + " — " + dropboxUploadUrl);
            } else {
              taxUploadText = "<br><br>On that note, we do need your tax returns. Please upload the last 3 years' returns. We will send you a secure upload link shortly.";
              Logger.log("C21: Dropbox link failed for " + clientName + " — fallback text used");
            }
          } catch (err) {
            taxUploadText = "<br><br>On that note, we do need your tax returns. Please upload the last 3 years' returns. We will send you a secure upload link shortly.";
            Logger.log("C21: Dropbox error for " + clientName + ": " + err.message);
          }
        }

        var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
        var pfName = String(row[COL.PF - 1]).trim();

        if (serviceLevel === "Core" || serviceLevel === "Max") {
          serviceLevelText = "As a result of choosing " + serviceLevel + " Membership, your next Partners in Planning Meeting will be in approximately 3 months.<br><br>Nearer the time, I will coordinate with you, " + memberName + " and " + pfName + ".<br><br>At that meeting they will be following up on progress to date, look further ahead and establish if there are any changes to your Priority Plan.";
        } else {
          serviceLevelText = "As a result of choosing Lite Membership, your next Partners in Planning Meeting will be in approximately 12 months.<br><br>In the meantime, should any matters arise regarding more immediate help, please reach out to me or " + memberName + " and we will be delighted to help further.";
        }
      }

      var totalPaymentsStr = paymentPlan === "Quarterly" ? "4" : "1";

      emailSubject = emailSubject
        .replace(/\[Client Name\]/g, clientName)
        .replace(/\[Receipt Number\]/g, receiptId)
        .replace(/\[Invoice Number\]/g, invoiceNumber);

      var paymentMethodType21 = String(row[COL.PAYMENT_METHOD_TYPE - 1]).trim();
      var cardFee21 = paymentMethodType21 === "card" ? Math.round((paymentAmount * 0.029 + 0.30) * 100) / 100 : 0;
      var totalCharged21 = paymentMethodType21 === "card" ? paymentAmount + cardFee21 : paymentAmount;

      var processingTime21 = paymentMethodType21 === "card"
        ? "As you paid by card, your payment has been processed immediately."
        : "As you paid via ACH bank transfer, please allow 2-4 business days for the funds to clear.";

      var cardFeeText21 = "";
      if (paymentMethodType21 === "card" && cardFee21 > 0) {
        cardFeeText21 = "<br><br>A card processing fee of $" + formatMoney(cardFee21) + " (2.9% + $0.30) was applied. Total amount charged: $" + formatMoney(totalCharged21) + ".";
      }

      emailBody = emailBody
        .replace(/\[Client Name\]/g, clientName)
        .replace(/\[Client First\]/g, clientFirst)
        .replace(/\[Receipt Number\]/g, receiptId)
        .replace(/\[Invoice Number\]/g, invoiceNumber)
        .replace(/\[Payment Amount\]/g, "$" + formatMoney(paymentAmount))
        .replace(/\[Service Level\]/g, serviceLevel)
        .replace(/\[X\]/g, String(paymentNumber))
        .replace(/\[Y\]/g, totalPaymentsStr)
        .replace(/\[PRIORITIES\]/g, priorityHTML)
        .replace(/\[SPECIALIST_INTRO\]/g, specialistIntro)
        .replace(/\[TAX_UPLOAD\]/g, taxUploadText)
        .replace(/\[SERVICE_LEVEL_TEXT\]/g, serviceLevelText)
        .replace(/\[PROCESSING_TIME\]/g, processingTime21)
        .replace(/\[CARD_FEE_TEXT\]/g, cardFeeText21);

      var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

      if (paymentNumber === 1) {
        attachments = [invPdfBlob, recPdfBlob];
      } else {
        attachments = [recPdfBlob];
      }

      try {
        var pfName21 = String(row[COL.PF - 1]).trim();
        var pfEmail21 = getPFEmail(pfName21);
        var memberEmail21 = String(row[COL.MEMBER_EMAIL - 1]).trim();
        var extraCc21 = String(row[COL.EXTRA_CC - 1]).trim();
        var ccList21 = [memberEmail21, pfEmail21, "tnmiller@vfo-services.com"].filter(function(e) { return e && e !== ""; });
        if (extraCc21) {
          var extraParts21 = extraCc21.split(",");
          for (var ec21 = 0; ec21 < extraParts21.length; ec21++) {
            var trimmedEc21 = extraParts21[ec21].trim();
            if (trimmedEc21) ccList21.push(trimmedEc21);
          }
        }
        var uniqueCc21 = ccList21.filter(function(v, i, a) { return a.indexOf(v) === i; });
        GmailApp.createDraft(clientEmail, emailSubject, "", {
          htmlBody: emailBody + signature,
          attachments: attachments,
          cc: uniqueCc21.join(","),
          bcc: "aanderson@elitert.com,platham@elitert.com",
          name: "VFO Services"
        });
        Logger.log("C21: Gmail draft created for " + clientName + " — " + emailSubject);
      } catch (err) {
        Logger.log("C21: Error creating draft: " + err.message);
        pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Receipt Needed");
        continue;
      }

      if (paymentNumber === 1 && sourceSSID) {
        updateClientTrackingCell(sourceSSID, clientRef, "G43");
        updateClientTrackingCell(sourceSSID, clientRef, "G44");
      }

      pipeline.getRange(sheetRow, recCols[paymentNumber].number).setValue(receiptId);
      pipeline.getRange(sheetRow, recCols[paymentNumber].status).setValue("Sent");
      pipeline.getRange(sheetRow, recCols[paymentNumber].driveId).setValue(recFileId);
      pipeline.getRange(sheetRow, recCols[paymentNumber].emailSent).setValue("Yes");

      if (paymentNumber === 1) {
        pipeline.getRange(sheetRow, COL.INVOICE_EMAIL_SENT).setValue("Yes");
      }

      Logger.log("C20/C21: Complete for " + clientName + " | Payment " + paymentNumber + " | " + receiptId);
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// C22 — Check VFO Services - Private Info for Human Input
// ============================================================

function processC22RevShare() {
  var REVENUE_MASTER_ID = "1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0";
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

  var pendingRows = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var c22Status = String(row[COL.REC1_REV_SHARE - 1]).trim();
    var rec1EmailSent = String(row[COL.REC1_EMAIL_SENT - 1]).trim();
    var rec1Number = String(row[COL.REC1_NUMBER - 1]).trim();

    if (c22Status === "Completed - Revenue Share" || c22Status === "Completed - Money Mapping") continue;
    if (rec1EmailSent !== "Yes" || !rec1Number) continue;

    var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
    var netInvoice = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;
    var memberContribution = parseFloat(String(row[COL.MEMBER_CONTRIBUTION - 1]).replace(/[,$]/g, "")) || 0;
    var contribStatus = String(row[COL.MEMBER_CONTRIB_STATUS - 1]).trim();
    var expectedAmount = paymentPlan === "Quarterly" ? netInvoice / 4 : netInvoice;

    pendingRows.push({
      pipelineRow: i + 2,
      clientRef: String(row[COL.CLIENT_REF - 1]).trim(),
      receiptNumber: rec1Number,
      sourceSSID: String(row[COL.SOURCE_SS_ID - 1]).trim(),
      expectedAmount: expectedAmount,
      memberContribution: memberContribution,
      contribStatus: contribStatus
    });
  }

  if (pendingRows.length === 0) {
    Logger.log("C22: No pending rows");
    return;
  }

  var revMaster = SpreadsheetApp.openById(REVENUE_MASTER_ID);
  var homePage = revMaster.getSheets()[0];
  var revLastRow = homePage.getLastRow();
  if (revLastRow < 2) return;

  var refData = homePage.getRange(2, 1, revLastRow - 1, 1).getValues();
  var linkData = homePage.getRange(2, 9, revLastRow - 1, 1).getRichTextValues();

  var refToSheetId = {};
  for (var r = 0; r < refData.length; r++) {
    var ref = String(refData[r][0]).trim();
    if (!ref) continue;
    var richText = linkData[r][0];
    if (!richText) continue;
    var url = richText.getLinkUrl();
    if (!url) {
      var runs = richText.getRuns();
      for (var ru = 0; ru < runs.length; ru++) {
        var runUrl = runs[ru].getLinkUrl();
        if (runUrl) { url = runUrl; break; }
      }
    }
    if (url) {
      var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) refToSheetId[ref] = match[1];
    }
  }

  for (var p = 0; p < pendingRows.length; p++) {
    var pending = pendingRows[p];
    var batchSheetId = refToSheetId[pending.clientRef];

    if (!batchSheetId) {
      Logger.log("C22: No batch sheet found for " + pending.clientRef);
      continue;
    }

    try {
      var batchSS = SpreadsheetApp.openById(batchSheetId);
      var allTabs = batchSS.getSheets();
      var receiptFound = false;
      var contribFound = false;
      var needsContrib = pending.memberContribution > 0 && pending.contribStatus !== "Completed";

      for (var t = 0; t < allTabs.length; t++) {
        var tab = allTabs[t];
        var tabName = tab.getName();

        try {
          if (String(tab.getRange("Z1").getValue()).trim() !== "Input") continue;
        } catch (e) { continue; }

        if (tabName.indexOf(pending.clientRef) === -1) continue;

        var tabLastRow = tab.getLastRow();
        if (tabLastRow < 7) continue;

        // Scan columns G through N (7 columns starting at G=7, plus I-N = columns 9-14)
        var scanRange = tab.getRange(7, 7, tabLastRow - 6, 9).getValues();

        for (var s = 0; s < scanRange.length; s++) {
          var colG = String(scanRange[s][0]).trim();
          var colI = String(scanRange[s][2]).trim();
          var colJ = parseFloat(String(scanRange[s][3]).replace(/[,$]/g, "")) || 0;
          var colK = parseFloat(String(scanRange[s][4]).replace(/[,$]/g, "")) || 0;
          var colL = parseFloat(String(scanRange[s][5]).replace(/[,$]/g, "")) || 0;
          var colM = parseFloat(String(scanRange[s][6]).replace(/[,$]/g, "")) || 0;
          var colN = parseFloat(String(scanRange[s][7]).replace(/[,$]/g, "")) || 0;

          // Check for Member Contribution row
          if (colG === "Member Contribution" && needsContrib && !contribFound) {
            var expectedContrib = Math.round(pending.memberContribution * 100) / 100;
            var actualContrib = Math.round(colJ * 100) / 100;
            if (actualContrib === expectedContrib) {
              contribFound = true;
              Logger.log("C22: Member contribution verified for " + pending.clientRef + " | $" + colJ);
            } else {
              Logger.log("C22: Member contribution mismatch for " + pending.clientRef + " | Found=$" + colJ + " expected=$" + pending.memberContribution);
            }
            continue;
          }

          // Check for Receipt row
          if (colI === pending.receiptNumber && !receiptFound) {
            if (colJ === 0) continue;

            var colO = parseFloat(String(scanRange[s][8]).replace(/[,$]/g, "")) || 0;
              var shareSum = Math.round((colK + colL + colM + colN + colO) * 100) / 100;
            var totalRounded = Math.round(colJ * 100) / 100;
            var expectedRounded = Math.round(pending.expectedAmount * 100) / 100;

            if (totalRounded !== expectedRounded) {
              Logger.log("C22: Amount mismatch for " + pending.clientRef + " | J=$" + revTotal + " expected=$" + pending.expectedAmount + " — will recheck next run");
              continue;
            }

            if (shareSum === totalRounded) {
              receiptFound = true;
              Logger.log("C22: Receipt share verified for " + pending.clientRef + " | Receipt: " + pending.receiptNumber + " | Total: $" + colJ);
            } else {
              Logger.log("C22: Share mismatch for " + pending.clientRef + " | J=$" + colJ + " K+L+M+N=$" + shareSum);
            }
          }
        }

        if (receiptFound) break;
      }

      // Determine final status
      if (receiptFound) {
        var currentRevShare = String(pipeline.getRange(pending.pipelineRow, COL.REC1_REV_SHARE).getValue()).trim();
        if (currentRevShare === "Amount Mismatch") continue;

        if (needsContrib && !contribFound) {
          // Receipt is good but member contribution not yet verified
          if (currentRevShare === "") {
            pipeline.getRange(pending.pipelineRow, COL.REC1_REV_SHARE).setValue("Pending");
          }
          Logger.log("C22: Receipt verified but member contribution not yet found for " + pending.clientRef);
        } else {
          // Everything checks out — determine Revenue Share or Money Mapping
          var memberNum22 = String(pipeline.getRange(pending.pipelineRow, COL.MEMBER_NUM).getValue()).trim();
          var revType = "Revenue Share";
          try {
            var mmSS = SpreadsheetApp.openById("1hV2h-E6YcolHQY50q_rb-ETx3iEEl9uvnngZajKgxCA");
            var advisorSheet22 = mmSS.getSheetByName("Advisor Home");
            if (advisorSheet22 && advisorSheet22.getLastRow() >= 2) {
              var advisorData22 = advisorSheet22.getRange(2, 1, advisorSheet22.getLastRow() - 1, 18).getValues();
              for (var mm = 0; mm < advisorData22.length; mm++) {
                if (String(advisorData22[mm][0]).trim() === memberNum22) {
                  var colR = String(advisorData22[mm][17]).trim();
                  if (colR === "Money Mapping") revType = "Money Mapping";
                  break;
                }
              }
            }
          } catch (err) {
            Logger.log("C22: Could not check Advisor Home for " + memberNum22 + ": " + err.message);
          }

          pipeline.getRange(pending.pipelineRow, COL.REC1_REV_SHARE).setValue("Completed - " + revType);
          if (needsContrib) {
            pipeline.getRange(pending.pipelineRow, COL.MEMBER_CONTRIB_STATUS).setValue("Completed");
          }
          Logger.log("C22: Revenue share verified for " + pending.clientRef + " | Receipt: " + pending.receiptNumber + " | Type: " + revType);

          if (pending.sourceSSID) {
            updateClientTrackingCell(pending.sourceSSID, pending.clientRef, "G45");
          }
        }
      } else {
        if (String(pipeline.getRange(pending.pipelineRow, COL.REC1_REV_SHARE).getValue()).trim() === "") {
          pipeline.getRange(pending.pipelineRow, COL.REC1_REV_SHARE).setValue("Pending");
        }
        Logger.log("C22: Not yet complete for " + pending.clientRef);
      }

    } catch (err) {
      Logger.log("C22: Error checking batch sheet for " + pending.clientRef + ": " + err.message);
    }
  }
}

// ============================================================
// TRACY REVENUE SHARE REMINDER (Daily)
// ============================================================

function sendTracyRevShareReminder() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  var tracyEmail = "tnmiller@vfo-services.com";

  var pendingItems = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    var recCols = {
      1: { revShare: COL.REC1_REV_SHARE, number: COL.REC1_NUMBER },
      2: { revShare: COL.REC2_REV_SHARE, number: COL.REC2_NUMBER },
      3: { revShare: COL.REC3_REV_SHARE, number: COL.REC3_NUMBER },
      4: { revShare: COL.REC4_REV_SHARE, number: COL.REC4_NUMBER }
    };

    for (var pn = 1; pn <= 4; pn++) {
      var revShareStatus = String(row[recCols[pn].revShare - 1]).trim();
      var recNumber = String(row[recCols[pn].number - 1]).trim();

      if (revShareStatus !== "Pending" || !recNumber || recNumber === "N/A") continue;

      var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
      var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
      var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
      var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
      var grossFee = String(row[COL.GROSS_FEE - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var totalFee = parseFloat(String(grossFee).replace(/[,$]/g, "")) || 0;
      var paymentAmount = paymentPlan === "Quarterly" ? totalFee / 4 : totalFee;

      pendingItems.push({
        clientRef: clientRef,
        clientName: clientName,
        memberName: memberName,
        serviceLevel: serviceLevel,
        receiptNumber: recNumber,
        paymentNumber: pn,
        paymentAmount: paymentAmount
      });
    }
  }

  if (pendingItems.length === 0) {
    Logger.log("TracyReminder: No pending revenue share items");
    return;
  }

  // Build one email covering all pending items
  var itemsHtml = "";
  for (var p = 0; p < pendingItems.length; p++) {
    var item = pendingItems[p];
    itemsHtml += '<tr style="' + (p % 2 === 0 ? 'background:#f8fafc;' : '') + '">'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + item.clientName + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + item.clientRef + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + item.memberName + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' + item.receiptNumber + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">Payment ' + item.paymentNumber + '</td>'
      + '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">$' + formatMoney(item.paymentAmount) + '</td>'
      + '</tr>';
  }

  var emailBody = '<p>Hi Tracy,</p>'
    + '<p>The following revenue share entries are still outstanding in the Private Info sheet and need to be completed:</p>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">'
    + '<thead><tr>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Client</th>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Ref</th>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Member</th>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Receipt #</th>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Payment</th>'
    + '<th style="background:#00488d;color:white;padding:8px 12px;text-align:left;">Amount</th>'
    + '</tr></thead>'
    + '<tbody>' + itemsHtml + '</tbody>'
    + '</table>'
    + '<p style="color:#64748b;font-size:13px;">Please ensure the revenue share columns balance for each receipt. The pipeline cannot progress until these are completed.</p>';

  try {
    GmailApp.createDraft(tracyEmail, "Action Required: Revenue Share Outstanding (" + pendingItems.length + " item" + (pendingItems.length > 1 ? "s" : "") + ")", "", {
      htmlBody: emailBody + signature
    });
    Logger.log("TracyReminder: Draft created for " + pendingItems.length + " pending items");
  } catch (err) {
    Logger.log("TracyReminder: Error creating draft: " + err.message);
  }
}

function processRevSharePayout() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("RevPayout: Could not acquire lock — another instance is running");
    return;
  }

  try {
    var MEMBER_MASTER_ID = "1hV2h-E6YcolHQY50q_rb-ETx3iEEl9uvnngZajKgxCA";
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var pipeline = ss.getSheetByName(PIPELINE_TAB);
    if (!pipeline) return;

    var lastRow = pipeline.getLastRow();
    if (lastRow < 2) return;
    var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

    var recCols = {
      1: { revShare: COL.REC1_REV_SHARE, revPaid: COL.REC1_REV_PAID },
      2: { revShare: COL.REC2_REV_SHARE, revPaid: COL.REC2_REV_PAID },
      3: { revShare: COL.REC3_REV_SHARE, revPaid: COL.REC3_REV_PAID },
      4: { revShare: COL.REC4_REV_SHARE, revPaid: COL.REC4_REV_PAID }
    };

    // Load member Connect IDs from master list
    var memberSS = SpreadsheetApp.openById(MEMBER_MASTER_ID);
    var connectLookup = {};

    var advisorSheet = memberSS.getSheetByName("Advisor Home");
    if (advisorSheet && advisorSheet.getLastRow() >= 2) {
      var advisorData = advisorSheet.getRange(2, 1, advisorSheet.getLastRow() - 1, 21).getValues();
      for (var a = 0; a < advisorData.length; a++) {
        var memNum = String(advisorData[a][0]).trim();
        var connectId = String(advisorData[a][20]).trim();
        if (memNum && connectId && connectId !== "ERROR" && connectId !== "Pending") {
          connectLookup[memNum] = connectId;
        }
      }
    }

    var accountantSheet = memberSS.getSheetByName("Accountant Home");
    if (accountantSheet && accountantSheet.getLastRow() >= 2) {
      var accountantData = accountantSheet.getRange(2, 1, accountantSheet.getLastRow() - 1, 27).getValues();
      for (var b = 0; b < accountantData.length; b++) {
        var memNum2 = String(accountantData[b][0]).trim();
        var connectId2 = String(accountantData[b][26]).trim();
        if (memNum2 && connectId2 && connectId2 !== "ERROR" && connectId2 !== "Pending") {
          connectLookup[memNum2] = connectId2;
        }
      }
    }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];

      // Find which payment's rev share is completed but not yet paid
      var paymentNumber = 0;
      for (var pn = 1; pn <= 4; pn++) {
        var revShareStatus = String(row[recCols[pn].revShare - 1]).trim();
        var revPaid = String(row[recCols[pn].revPaid - 1]).trim();
        if ((revShareStatus === "Completed - Revenue Share" || revShareStatus === "Completed - Money Mapping") && revPaid !== "Yes" && revPaid !== "N/A" && revPaid !== "N/A — No Share Due" && revPaid !== "Paying" && revPaid !== "Money Mapping") {
          paymentNumber = pn;
          break;
        }
      }
      if (paymentNumber === 0) continue;

      var sheetRow = i + 2;

      // Set intermediate status
      pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("Paying");
      SpreadsheetApp.flush();

      var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
      var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
      var memberNum = String(row[COL.MEMBER_NUM - 1]).trim();
      var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
      var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
      var netInvoice = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;
      var paymentAmount = netInvoice;
      if (paymentPlan === "Quarterly" && netInvoice > 0) paymentAmount = netInvoice / 4;

      var memberShareVal = parseFloat(String(row[COL.MEMBER_SHARE - 1]).replace(/[,$%]/g, "")) || 0;

      // Calculate rev share amount
      var revShareAmount = 0;
      if (memberShareVal > 100) {
        revShareAmount = paymentPlan === "Quarterly" ? memberShareVal / 4 : memberShareVal;
      } else {
        revShareAmount = paymentAmount * (memberShareVal / 100);
      }

      if (revShareAmount <= 0) {
        Logger.log("RevPayout: Zero rev share for " + clientRef + " — no payout needed");
        pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("N/A — No Share Due");
        continue;
      }

      // Check if Money Mapping — skip Stripe transfer
      var revShareStatus = String(row[recCols[paymentNumber].revShare - 1]).trim();
      if (revShareStatus === "Completed - Money Mapping") {
        pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("Money Mapping");
        Logger.log("RevPayout: Money Mapping for " + clientRef + " payment " + paymentNumber + " — $" + formatMoney(revShareAmount) + " held (no Stripe transfer)");
        continue;
      }

      // Look up member's Connect ID
      var connectAccountId = connectLookup[memberNum] || "";
      if (!connectAccountId) {
        Logger.log("RevPayout: No Stripe Connect ID for member " + memberNum + " (" + memberName + ")");
        pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("No Connect ID");
        continue;
      }

      // Send transfer
      var amountCents = Math.round(revShareAmount * 100);
      var idempotencyKey = clientRef + "-revshare-pay" + paymentNumber + "-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");

      try {
        var transfer = stripeRequest("transfers", {
          "amount": String(amountCents),
          "currency": "usd",
          "destination": connectAccountId,
          "description": "Rev share — " + clientName + " (" + clientRef + ") — Payment " + paymentNumber,
          "metadata[client_ref]": clientRef,
          "metadata[member_num]": memberNum,
          "metadata[payment_number]": String(paymentNumber),
          "idempotency_key": idempotencyKey
        });

        if (transfer && transfer.id) {
          pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("Yes");
          Logger.log("RevPayout: $" + formatMoney(revShareAmount) + " sent to " + memberName + " (" + connectAccountId + ") for " + clientRef + " payment " + paymentNumber);
        } else {
          pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("Failed");
          Logger.log("RevPayout: Transfer failed for " + memberName + " — " + JSON.stringify(transfer));
        }
      } catch (err) {
        pipeline.getRange(sheetRow, recCols[paymentNumber].revPaid).setValue("Error");
        Logger.log("RevPayout: Error for " + memberName + ": " + err.message);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// C23
// ============================================================

function processC23RevShareEmail() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.EXTRA_CC).getValues();

  var recCols = {
    1: { revShare: COL.REC1_REV_SHARE, revPaid: COL.REC1_REV_PAID, revEmail: COL.REC1_REV_EMAIL_SENT, number: COL.REC1_NUMBER },
    2: { revShare: COL.REC2_REV_SHARE, revPaid: COL.REC2_REV_PAID, revEmail: COL.REC2_REV_EMAIL_SENT, number: COL.REC2_NUMBER },
    3: { revShare: COL.REC3_REV_SHARE, revPaid: COL.REC3_REV_PAID, revEmail: COL.REC3_REV_EMAIL_SENT, number: COL.REC3_NUMBER },
    4: { revShare: COL.REC4_REV_SHARE, revPaid: COL.REC4_REV_PAID, revEmail: COL.REC4_REV_EMAIL_SENT, number: COL.REC4_NUMBER }
  };

  // Load templates
  var templateSheet = ss.getSheetByName("Email Templates");
  if (!templateSheet) return;
  var tData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
  var templates = {};
  for (var t = 0; t < tData.length; t++) {
    var sendStep = String(tData[t][2]).trim();
    var condition = String(tData[t][4]).trim();
    if (sendStep === "C23") {
      templates[condition] = { subject: String(tData[t][5]).trim(), body: String(tData[t][6]).trim() };
    }
  }


  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    // Find which payment's rev share is completed but email not sent
    var paymentNumber = 0;
    for (var pn = 1; pn <= 4; pn++) {
      var revShareStatus = String(row[recCols[pn].revShare - 1]).trim();
      var revPaid = String(row[recCols[pn].revPaid - 1]).trim();
      var revEmailSent = String(row[recCols[pn].revEmail - 1]).trim();
      if ((revShareStatus === "Completed - Revenue Share" || revShareStatus === "Completed - Money Mapping") && (revPaid === "Yes" || revPaid === "N/A — No Share Due" || revPaid === "Money Mapping") && revEmailSent !== "Yes") {
        paymentNumber = pn;
        break;
      }
    }
    if (paymentNumber === 0) continue;

    var sheetRow = i + 2;
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var memberFirst = String(row[COL.MEMBER_FIRST - 1]).trim();
    var memberName = memberFirst + " " + String(row[COL.MEMBER_LAST - 1]).trim();
    var memberEmail = String(row[COL.MEMBER_EMAIL - 1]).trim();
    var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
    var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
    var grossFee = parseFloat(String(row[COL.GROSS_FEE - 1]).replace(/[,$]/g, "")) || 0;
    var memberContribution = parseFloat(String(row[COL.MEMBER_CONTRIBUTION - 1]).replace(/[,$]/g, "")) || 0;
    var netInvoice = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;
    var paymentAmount = netInvoice;
    if (paymentPlan === "Quarterly" && netInvoice > 0) paymentAmount = netInvoice / 4;
    var memberSharePct = String(row[COL.MEMBER_SHARE - 1]).trim();
    var memberShareVal = parseFloat(String(memberSharePct).replace(/[,$%]/g, "")) || 0;
    var invoiceNumber = String(row[COL.INVOICE_NUMBER - 1]).trim();
    var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();
    var tz = Session.getScriptTimeZone();

    var isQuarterly = paymentPlan === "Quarterly";
    var totalPayments = isQuarterly ? 4 : 1;
    var hasContribution = memberContribution > 0;

    // Calculate rev share amount
    var revShareAmount = 0;
    if (memberShareVal > 100) {
      revShareAmount = isQuarterly ? memberShareVal / 4 : memberShareVal;
    } else {
      revShareAmount = paymentAmount * (memberShareVal / 100);
    }

    // Calculate totals based on net (what client pays)
    var totalPaid = paymentAmount * paymentNumber;
    var balanceOutstanding = netInvoice - totalPaid;

    // Build outstanding schedule
    var outstandingSchedule = "";
    if (isQuarterly && paymentNumber < 4) {
      var scheduleItems = "";
      for (var future = paymentNumber + 1; future <= 4; future++) {
        var futureDateCol = COL.PAY1_DATE + ((future - 1) * 2);
        var futureDate = row[futureDateCol - 1];
        var futureDateStr = "";
        if (futureDate instanceof Date) {
          futureDateStr = Utilities.formatDate(futureDate, tz, "MMMM d, yyyy");
        } else if (futureDate) {
          var pd = new Date(futureDate);
          if (!isNaN(pd.getTime())) futureDateStr = Utilities.formatDate(pd, tz, "MMMM d, yyyy");
          else futureDateStr = String(futureDate);
        }
        scheduleItems += "&bull; $" + formatMoney(paymentAmount) + " due on " + (futureDateStr || "TBD") + "<br>";
      }
      outstandingSchedule = '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;margin-bottom:24px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00488d;margin-bottom:10px;">Remaining schedule</div><div style="font-size:13px;color:#334155;line-height:1.8;">' + scheduleItems + '</div></div>';
    }

    // Next payment text
    var nextPaymentText = "";
    if (isQuarterly) {
      if (paymentNumber < 4) {
        nextPaymentText = "When your client makes the next anticipated quarterly payment as agreed, we will notify you and repeat the above payment process (unless you wish to change your payment preference next time, in which case let us know).";
      } else {
        nextPaymentText = "";
      }
    }

    // Member contribution text — only shown if applicable
    var contributionText = "";
    if (hasContribution && paymentNumber === 1) {
      if (revShareAmount <= 0) {
        contributionText = '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;"><div style="font-size:13px;color:#64748b;">As your contribution of <strong style="color:#1e293b;">$' + formatMoney(memberContribution) + '</strong> covers your share, no revenue share payment is due for this engagement.</div></div>';
      } else {
        contributionText = '<p style="font-size:13px;color:#64748b;line-height:1.7;margin:0 0 8px;">Your contribution of <strong style="color:#1e293b;">$' + formatMoney(memberContribution) + '</strong> has been applied, reducing your revenue share accordingly.</p>';
      }
    }

    // Determine rev share line based on revenue share type
    var revShareStatus = String(row[recCols[paymentNumber].revShare - 1]).trim();
    var revShareLine = "";
    if (revShareAmount <= 0) {
      revShareLine = "";
    } else if (revShareStatus === "Completed - Money Mapping") {
      revShareLine = '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#00488d;border-radius:8px;"><tr><td style="color:white;padding:16px 20px;font-size:13px;font-weight:600;">Allocated to Money Mapping</td><td style="color:white;padding:16px 20px;text-align:right;font-size:20px;font-weight:700;">$' + formatMoney(revShareAmount) + '</td></tr></table>';
    } else {
      revShareLine = '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#00488d;border-radius:8px;"><tr><td style="color:white;padding:16px 20px;font-size:13px;font-weight:600;">Your revenue share</td><td style="color:white;padding:16px 20px;text-align:right;font-size:20px;font-weight:700;">$' + formatMoney(revShareAmount) + '</td></tr></table>';
    }
    
    // Pick template
    var templateKey = paymentNumber === 1 ? "RevFirst" : "RevSubsequent";
    var tmpl = templates[templateKey];
    if (!tmpl || !tmpl.body) {
      Logger.log("C23: No template found for " + templateKey);
      continue;
    }

    var subject = tmpl.subject
      .replace(/\[Member Name\]/g, memberName)
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client Ref\]/g, clientRef)
      .replace(/\[X\]/g, String(paymentNumber))
      .replace(/\[Y\]/g, String(totalPayments));

    var body = tmpl.body
      .replace(/\[Member Name\]/g, memberName)
      .replace(/\[Member First\]/g, memberFirst)
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client Ref\]/g, clientRef)
      .replace(/\[Invoice Number\]/g, invoiceNumber)
      .replace(/\[Invoice Total\]/g, "$" + formatMoney(grossFee))
      .replace(/\[Payment Amount\]/g, "$" + formatMoney(paymentAmount))
      .replace(/\[X\]/g, String(paymentNumber))
      .replace(/\[Y\]/g, String(totalPayments))
      .replace(/\[Total Paid\]/g, "$" + formatMoney(totalPaid))
      .replace(/\[Balance Outstanding\]/g, "$" + formatMoney(balanceOutstanding))
      .replace(/\[Rev Share Amount\]/g, "$" + formatMoney(revShareAmount))
      .replace(/\[OUTSTANDING_SCHEDULE\]/g, outstandingSchedule)
      .replace(/\[NEXT_PAYMENT_TEXT\]/g, nextPaymentText)
      .replace(/\[CONTRIBUTION_LINES\]/g, hasContribution ? '<tr><td style="color:#64748b;padding:5px 0;">Member contribution</td><td style="text-align:right;padding:5px 0;font-weight:600;color:#16a34a;">-$' + formatMoney(memberContribution) + '</td></tr><tr><td style="color:#64748b;padding:5px 0;">Net invoice value</td><td style="text-align:right;padding:5px 0;font-weight:600;color:#1e293b;">$' + formatMoney(netInvoice) + '</td></tr>' : '')
      .replace(/\[REV_SHARE_LINE\]/g, revShareLine)
      .replace(/\[MEMBER_CONTRIBUTION_TEXT\]/g, contributionText);

    try {
      var pfName23 = String(row[COL.PF - 1]).trim();
      var pfEmail23 = getPFEmail(pfName23);
      var ccList23 = [pfEmail23].filter(function(e) { return e && e !== "" && e !== memberEmail; });
      GmailApp.createDraft(memberEmail, subject, "", {
        htmlBody: body,
        cc: ccList23.join(","),
        bcc: "aanderson@elitert.com,platham@elitert.com",
        name: "VFO Services"
      });
      Logger.log("C23: Rev share email draft created for " + memberName + " — payment " + paymentNumber + " — $" + formatMoney(revShareAmount));
    } catch (err) {
      Logger.log("C23: Error creating draft: " + err.message);
      continue;
    }

    pipeline.getRange(sheetRow, recCols[paymentNumber].revEmail).setValue("Yes");

    // Update Client Tracking
    if (paymentNumber === 1 && sourceSSID) {
      updateClientTrackingCell(sourceSSID, clientRef, "G46");
    }

    Logger.log("C23: Complete for " + memberName + " | Payment " + paymentNumber);
  }
}

// ============================================================
// C24
// ============================================================

function processC24TracyEmail() {
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

  var templateSheet = ss.getSheetByName("Email Templates");
  if (!templateSheet) return;
  var tData = templateSheet.getRange(2, 1, templateSheet.getLastRow() - 1, 7).getValues();
  var tmpl = null;
  for (var t = 0; t < tData.length; t++) {
    if (String(tData[t][2]).trim() === "C24" && String(tData[t][4]).trim() === "Tracy") {
      tmpl = { subject: String(tData[t][5]).trim(), body: String(tData[t][6]).trim() };
      break;
    }
  }
  if (!tmpl || !tmpl.body) {
    Logger.log("C24: No template found");
    return;
  }

  var signature = '<p style="color:#00488d;margin-top:24px;border-top:1px solid #00488d;padding-top:16px;margin-bottom:0;"><strong style="font-size:15px;line-height:1.2;">AI-PC</strong><br><span style="font-size:13px;line-height:1.2;">Proactive Coordinator</span></p><p style="color:#00488d;margin-top:12px;"><strong style="font-size:18px;letter-spacing:0.5px;">VFO SERVICES</strong></p>';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rec1RevEmail = String(row[COL.REC1_REV_EMAIL_SENT - 1]).trim();
    var c24Sent = String(row[COL.C24_EMAIL_SENT - 1]).trim();

    // Trigger: first rev share email sent, C24 not yet sent
    if (rec1RevEmail !== "Yes" || c24Sent === "Yes") continue;

    var sheetRow = i + 2;
    var clientRef = String(row[COL.CLIENT_REF - 1]).trim();
    var clientName = String(row[COL.CLIENT_FIRST - 1]).trim() + " " + String(row[COL.CLIENT_LAST - 1]).trim();
    var memberName = String(row[COL.MEMBER_FIRST - 1]).trim() + " " + String(row[COL.MEMBER_LAST - 1]).trim();
    var serviceLevel = String(row[COL.SERVICE_LEVEL - 1]).trim();
    var sourceSSID = String(row[COL.SOURCE_SS_ID - 1]).trim();

    var priorities = String(row[COL.CURRENT_PRIORITIES - 1]).trim();
    var priorityHTML = "";
    if (priorities && priorities !== "N/A") {
      var parts = priorities.split(",");
      priorityHTML = "<ol>";
      for (var p = 0; p < parts.length; p++) {
        var pri = parts[p].trim();
        if (pri) priorityHTML += "<li>" + pri + "</li>";
      }
      priorityHTML += "</ol>";
    }

    var subject = tmpl.subject
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client Ref\]/g, clientRef);

    var body = tmpl.body
      .replace(/\[Client Name\]/g, clientName)
      .replace(/\[Client Ref\]/g, clientRef)
      .replace(/\[Member Name\]/g, memberName)
      .replace(/\[Service Level\]/g, serviceLevel)
      .replace(/\[PRIORITIES\]/g, priorityHTML);

    var tracyEmail = "tnmiller@vfo-services.com";

    try {
      GmailApp.createDraft(tracyEmail, subject, "", {
        htmlBody: body + signature,
        bcc: "aanderson@elitert.com,platham@elitert.com",
        name: "VFO Services"
      });
      Logger.log("C24: Tracy intro email draft created for " + clientName);
    } catch (err) {
      Logger.log("C24: Error creating draft: " + err.message);
      continue;
    }

    pipeline.getRange(sheetRow, COL.C24_EMAIL_SENT).setValue("Yes");

    if (sourceSSID) {
      updateClientTrackingCell(sourceSSID, clientRef, "G47");
    }

    Logger.log("C24: Complete for " + clientName);
  }
}

// ============================================================
// FUTURE PAYMENTS
// ============================================================

function processRevSharePayments234() {
  var REVENUE_MASTER_ID = "1PvUEWwTH70OBHabdHPh2SS9U7isITOzHmSd11GoHGJ0";
  var ss = SpreadsheetApp.openById(MASTER_SS_ID);
  var pipeline = ss.getSheetByName(PIPELINE_TAB);
  if (!pipeline) return;

  var lastRow = pipeline.getLastRow();
  if (lastRow < 2) return;
  var data = pipeline.getRange(2, 1, lastRow - 1, COL.REC4_REV_EMAIL_SENT).getValues();

  var recCols = {
    2: { emailSent: COL.REC2_EMAIL_SENT, number: COL.REC2_NUMBER, revShare: COL.REC2_REV_SHARE },
    3: { emailSent: COL.REC3_EMAIL_SENT, number: COL.REC3_NUMBER, revShare: COL.REC3_REV_SHARE },
    4: { emailSent: COL.REC4_EMAIL_SENT, number: COL.REC4_NUMBER, revShare: COL.REC4_REV_SHARE }
  };

  var pendingRows = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var paymentPlan = String(row[COL.PAYMENT_PLAN - 1]).trim();
    if (paymentPlan !== "Quarterly") continue;

    var netInvoice = parseFloat(String(row[COL.NET_INVOICE - 1]).replace(/[,$]/g, "")) || 0;
    var expectedAmount = netInvoice / 4;

    for (var pn = 2; pn <= 4; pn++) {
      var recEmailSent = String(row[recCols[pn].emailSent - 1]).trim();
      var recNumber = String(row[recCols[pn].number - 1]).trim();
      var revShareStatus = String(row[recCols[pn].revShare - 1]).trim();

      if (recEmailSent !== "Yes" || !recNumber || recNumber === "N/A") continue;
      if (revShareStatus === "Completed - Revenue Share" || revShareStatus === "Completed - Money Mapping") continue;

      pendingRows.push({
        pipelineRow: i + 2,
        clientRef: String(row[COL.CLIENT_REF - 1]).trim(),
        receiptNumber: recNumber,
        paymentNumber: pn,
        revShareCol: recCols[pn].revShare,
        sourceSSID: String(row[COL.SOURCE_SS_ID - 1]).trim(),
        expectedAmount: expectedAmount
      });
    }
  }

  if (pendingRows.length === 0) {
    Logger.log("RevShare234: No pending rows");
    return;
  }

  var revMaster = SpreadsheetApp.openById(REVENUE_MASTER_ID);
  var homePage = revMaster.getSheets()[0];
  var revLastRow = homePage.getLastRow();
  if (revLastRow < 2) return;

  var refData = homePage.getRange(2, 1, revLastRow - 1, 1).getValues();
  var linkData = homePage.getRange(2, 9, revLastRow - 1, 1).getRichTextValues();

  var refToSheetId = {};
  for (var r = 0; r < refData.length; r++) {
    var ref = String(refData[r][0]).trim();
    if (!ref) continue;
    var richText = linkData[r][0];
    if (!richText) continue;
    var url = richText.getLinkUrl();
    if (!url) {
      var runs = richText.getRuns();
      for (var ru = 0; ru < runs.length; ru++) {
        var runUrl = runs[ru].getLinkUrl();
        if (runUrl) { url = runUrl; break; }
      }
    }
    if (url) {
      var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) refToSheetId[ref] = match[1];
    }
  }

  for (var p = 0; p < pendingRows.length; p++) {
    var pending = pendingRows[p];
    var batchSheetId = refToSheetId[pending.clientRef];

    if (!batchSheetId) {
      Logger.log("RevShare234: No batch sheet found for " + pending.clientRef);
      continue;
    }

    try {
      var batchSS = SpreadsheetApp.openById(batchSheetId);
      var allTabs = batchSS.getSheets();
      var found = false;

      for (var t = 0; t < allTabs.length; t++) {
        var tab = allTabs[t];
        var tabName = tab.getName();

        try {
          if (String(tab.getRange("Z1").getValue()).trim() !== "Input") continue;
        } catch (e) { continue; }

        if (tabName.indexOf(pending.clientRef) === -1) continue;

        var tabLastRow = tab.getLastRow();
        if (tabLastRow < 7) continue;

        var scanRange = tab.getRange(7, 9, tabLastRow - 6, 7).getValues();

        for (var s = 0; s < scanRange.length; s++) {
          var receiptCell = String(scanRange[s][0]).trim();
          if (receiptCell !== pending.receiptNumber) continue;

          var revTotal = parseFloat(String(scanRange[s][1]).replace(/[,$]/g, "")) || 0;
          var k = parseFloat(String(scanRange[s][2]).replace(/[,$]/g, "")) || 0;
          var l = parseFloat(String(scanRange[s][3]).replace(/[,$]/g, "")) || 0;
          var m = parseFloat(String(scanRange[s][4]).replace(/[,$]/g, "")) || 0;
          var n = parseFloat(String(scanRange[s][5]).replace(/[,$]/g, "")) || 0;

          if (revTotal === 0) continue;

          var o = parseFloat(String(scanRange[s][6]).replace(/[,$]/g, "")) || 0;
          var shareSum = Math.round((k + l + m + n + o) * 100) / 100;
          var totalRounded = Math.round(revTotal * 100) / 100;
          var expectedRounded = Math.round(pending.expectedAmount * 100) / 100;

          if (totalRounded !== expectedRounded) {
            Logger.log("RevShare234: Amount mismatch for " + pending.clientRef + " payment " + pending.paymentNumber + " | J=$" + revTotal + " expected=$" + pending.expectedAmount + " — will recheck next run");
            continue;
          }

          if (shareSum === totalRounded) {
            // Determine Revenue Share or Money Mapping
            var memberNum234 = String(pipeline.getRange(pending.pipelineRow, COL.MEMBER_NUM).getValue()).trim();
            var revType234 = "Revenue Share";
            try {
              var mmSS234 = SpreadsheetApp.openById("1hV2h-E6YcolHQY50q_rb-ETx3iEEl9uvnngZajKgxCA");
              var advisorSheet234 = mmSS234.getSheetByName("Advisor Home");
              if (advisorSheet234 && advisorSheet234.getLastRow() >= 2) {
                var advisorData234 = advisorSheet234.getRange(2, 1, advisorSheet234.getLastRow() - 1, 18).getValues();
                for (var mm2 = 0; mm2 < advisorData234.length; mm2++) {
                  if (String(advisorData234[mm2][0]).trim() === memberNum234) {
                    var colR234 = String(advisorData234[mm2][17]).trim();
                    if (colR234 === "Money Mapping") revType234 = "Money Mapping";
                    break;
                  }
                }
              }
            } catch (err) {
              Logger.log("RevShare234: Could not check Advisor Home for " + memberNum234 + ": " + err.message);
            }

            pipeline.getRange(pending.pipelineRow, pending.revShareCol).setValue("Completed - " + revType234);
            Logger.log("RevShare234: Payment " + pending.paymentNumber + " verified for " + pending.clientRef + " | Receipt: " + pending.receiptNumber + " | Total: $" + revTotal + " | Type: " + revType234);
            found = true;
            break;
          } else {
            Logger.log("RevShare234: Share mismatch for " + pending.clientRef + " payment " + pending.paymentNumber + " | J=$" + revTotal + " K+L+M+N=$" + shareSum);
          }
        }

        if (found) break;
      }

      if (!found) {
        var currentStatus = String(pipeline.getRange(pending.pipelineRow, pending.revShareCol).getValue()).trim();
        if (currentStatus === "") {
          pipeline.getRange(pending.pipelineRow, pending.revShareCol).setValue("Pending");
        }
        Logger.log("RevShare234: Not yet complete for " + pending.clientRef + " payment " + pending.paymentNumber);
      }

    } catch (err) {
      Logger.log("RevShare234: Error checking batch sheet for " + pending.clientRef + ": " + err.message);
    }
  }
}

// =======================================================================================================================
// COMBINED WRAPPERS — MAP 1
// =======================================================================================================================

// ============================================================
// TRIGGER SCHEDULE
// ============================================================
//
// Every 10 minutes:
//   1. runMAP1EmailSenders              (sendPendingC8Emails → sendPendingC14Emails → sendPendingC16C17C18Emails)
//   2. runMAP1PostPaymentProcessing     (processC19Confirmations → processC20C21Receipts)
//   3. runMAP1RevSharePipeline          (processC22RevShare → processRevSharePayments234 → processRevSharePayout → processC23RevShareEmail → processC24TracyEmail)
//
// Daily:
//   4. processQuarterlyPayments         (Payments 2-4 only — charges on scheduled dates)
//   5. processFailedPaymentRetry
//   6. runMAP1DailyReminders            (sendPFPricingReminder → sendTracyRevShareReminder → sendPipelineHealthCheck)
//
// Every 2 hours:
//   7. runMAP1Pollers                   (pollWebhookFallback)
//
// ============================================================

/**
 * Group: Email Senders
 * All email draft creation functions in sequence
 * Trigger: Every 10 minutes
 */
function runMAP1EmailSenders() {
  sendPendingC8Emails();
  sendPendingC14Emails();
  sendPendingC16C17C18Emails();
}

/**
 * Group: Post-Payment Processing
 * Runs after payment succeeds: confirmation email → invoice/receipt generation
 * Trigger: Every 10 minutes
 */
function runMAP1PostPaymentProcessing() {
  processC19Confirmations();
  processC20C21Receipts();
}

/**
 * Group: Revenue Share Pipeline
 * Runs the full rev share chain: verify → payout → member email → Tracy email
 * Trigger: Every 10 minutes
 */
function runMAP1RevSharePipeline() {
  processC22RevShare();
  processRevSharePayments234();
  processRevSharePayout();
  processC23RevShareEmail();
  processC24TracyEmail();
}

/**
 * Group: Daily Reminders
 * All daily reminder/check emails in one run
 * Trigger: Daily
 */
function runMAP1DailyReminders() {
  sendFollowUpEmails();
  sendPFPricingReminder();
  sendTracyRevShareReminder();
  sendPipelineHealthCheck();
}

/**
 * Group: Pollers
 * Safety net for missed webhooks
 * Trigger: Every 2 hours
 */
function runMAP1Pollers() {
  pollWebhookFallback();
}
// =======================================================================================================================
// =======================================================================================================================

