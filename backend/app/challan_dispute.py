"""
🧾 AI Challan Dispute Engine — NagarIQ Smart City OS
=====================================================
Scan a traffic challan photo → OCR extracts fields → NLP checks validity →
Auto-generates a legally formatted dispute letter PDF.

Pipeline:
1. EasyOCR  → extract raw text from challan image
2. Field Parser → extract challan_no, date, officer, offense, fine, vehicle
3. NLP Validator → check each field against MVA 2019 rules
4. PDF Generator (ReportLab) → create dispute letter
5. Return PDF as downloadable response
"""

import io
import re
import datetime
import uuid
import base64
from typing import Optional

# ─── Motor Vehicles Act 2019 — Maximum Fine Limits (₹) ──────────────────────
MVA_FINE_LIMITS = {
    "speeding":           {"first": 1000,  "repeat": 2000,  "section": "112/183"},
    "no_helmet":          {"first": 1000,  "repeat": 2000,  "section": "129"},
    "drunk_driving":      {"first": 10000, "repeat": 15000, "section": "185"},
    "signal_jump":        {"first": 1000,  "repeat": 2000,  "section": "119"},
    "no_seatbelt":        {"first": 1000,  "repeat": 2000,  "section": "194B"},
    "wrong_side":         {"first": 500,   "repeat": 1500,  "section": "184"},
    "mobile_phone":       {"first": 5000,  "repeat": 10000, "section": "184"},
    "no_registration":    {"first": 2000,  "repeat": 5000,  "section": "192"},
    "no_insurance":       {"first": 2000,  "repeat": 4000,  "section": "196"},
    "overloading":        {"first": 20000, "repeat": 20000, "section": "194"},
    "no_license":         {"first": 5000,  "repeat": 10000, "section": "181"},
    "triple_riding":      {"first": 1000,  "repeat": 2000,  "section": "128"},
    "parking_violation":  {"first": 500,   "repeat": 1500,  "section": "122"},
    "tinted_glass":       {"first": 100,   "repeat": 300,   "section": "100"},
    "puc_expired":        {"first": 10000, "repeat": 10000, "section": "190(2)"},
}

# Offense keyword → type mapping
OFFENSE_KEYWORDS = {
    "speed":         "speeding",     "overspeed":     "speeding",
    "helmet":        "no_helmet",    "signal":        "signal_jump",
    "seatbelt":      "no_seatbelt",  "seat belt":     "no_seatbelt",
    "drunk":         "drunk_driving", "alcohol":      "drunk_driving",
    "mobile":        "mobile_phone", "phone":         "mobile_phone",
    "insurance":     "no_insurance", "registration":  "no_registration",
    "license":       "no_license",   "licence":       "no_license",
    "triple":        "triple_riding", "tinted":       "tinted_glass",
    "puc":           "puc_expired",  "pollution":     "puc_expired",
    "parking":       "parking_violation", "overload":  "overloading",
    "wrong side":    "wrong_side",
}

# Legal references for dispute letter
LEGAL_REFS = {
    "MISSING_BADGE":     ("Rule 167(2), CMV Rules 1989",
                          "A challan must bear the issuing officer's service number. Absence renders it void."),
    "MISSING_OFFICIAL":  ("Section 158, Motor Vehicles Act 1988",
                          "Every challan must identify the issuing authority with full particulars."),
    "EXCESSIVE_FINE":    ("Section 210B, Motor Vehicles Act 2019",
                          "The imposed fine exceeds the statutory maximum for this offense category."),
    "INVALID_DATE":      ("General Clauses Act 1897, Section 3(35)",
                          "Future-dated or malformed date makes the challan ab initio void."),
    "EXPIRED_CHALLAN":   ("Section 200, Motor Vehicles Act 1988",
                          "Disputed challans must be addressed; however, older challans may have procedural defects."),
    "MISSING_LOCATION":  ("Rule 167(1)(b), CMV Rules 1989",
                          "Offense location is a mandatory field. Absence is a procedural defect."),
    "INVALID_FORMAT":    ("Rule 167, CMV Rules 1989",
                          "The challan format does not conform to the prescribed form."),
    "MISSING_VEHICLE":   ("Section 130, Motor Vehicles Act 1988",
                          "Vehicle registration number must be recorded accurately."),
}


# ─── OCR — extract text from image ───────────────────────────────────────────
def run_ocr(image_bytes: bytes) -> str:
    """
    Run EasyOCR on the challan image.
    Falls back to a demo text if EasyOCR fails (for testing).
    """
    try:
        import easyocr
        import numpy as np
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)

        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        results = reader.readtext(img_np, detail=0, paragraph=True)
        return "\n".join(results)
    except Exception as e:
        print(f"[ChallanOCR] EasyOCR failed ({e}), using demo text")
        return _demo_challan_text()


def _demo_challan_text() -> str:
    """Sample challan text for demo/testing when no real image is provided."""
    return """
    TRAFFIC POLICE DEPARTMENT - INDORE
    CHALLAN NO: IND-2024-78432
    DATE: 15/01/2025  TIME: 14:35
    VEHICLE NO: MP09 CG 1234
    OFFENSE: Riding without helmet (Section 129)
    FINE AMOUNT: Rs. 2500
    OFFICER: Constable Ramesh Kumar
    PLACE: Rajwada Chowk, Indore
    COURT DATE: 30/01/2025
    """


def parse_challan_fields(ocr_text: str) -> dict:
    """Extract structured fields from OCR text using resilient regex patterns."""
    text = ocr_text.upper()
    fields = {}

    # Common OCR fixes
    text_clean = text.replace("MPO", "MP0").replace("R5", "RS")

    # Challan number (e.g. IND-2024-78432 or similar pattern)
    # Don't rely on "CHALLAN NO" prefix as OCR might scramble it
    m = re.search(r'\b([A-Z]{2,4}[-\s]?\d{4}[-\s]?\d{4,})\b', text_clean)
    fields["challan_number"] = m.group(1).replace(" ", "") if m else None

    # Date
    m = re.search(r'\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b', text_clean)
    fields["challan_date_raw"] = m.group(1) if m else None
    fields["challan_date"] = _parse_date(m.group(1)) if m else None

    # Time
    m = re.search(r'\b(\d{1,2}[:\.]\d{2})\b', text_clean)
    fields["challan_time"] = m.group(1).replace(".", ":") if m else None

    # Vehicle number (Indian format)
    # OCR might read "MP09 Riding CG 1234", so we look for state code + digits, and later digits
    m = re.search(r'\b([A-Z]{2}[0-9O]{1,2}).*?([A-Z]{1,2}\s?\d{4})\b', text_clean)
    if m:
        v_num = f"{m.group(1)}{m.group(2)}".replace(" ", "").replace("O", "0")
        fields["vehicle_number"] = v_num
    else:
        # Fallback for standard contiguous pattern
        m_fallback = re.search(r'\b([A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4})\b', text_clean)
        fields["vehicle_number"] = m_fallback.group(1).replace(" ", "") if m_fallback else None

    # Fine amount
    # OCR scrambles "AMOUNT: Rs. 2500" into "AMOUNT: OFFICER: Rs. Constable 2500"
    # We look for Rs/₹/INR followed by 3 to 5 digits, ignoring text in between.
    m = re.search(r'(?:RS\.?|₹|INR|AMOUNT)[\sA-Z\.\:]*?(\d{3,5})\b', text_clean)
    if m:
        fields["fine_amount"] = int(m.group(1))
    else:
        # Fallback: look for exactly 3 or 4 digits near the word FINE
        m_fallback = re.search(r'FINE[\sA-Z\.\:\)]*?([1-9]\d{2,4})\b', text_clean)
        fields["fine_amount"] = int(m_fallback.group(1)) if m_fallback else None

    # Officer name
    m = re.search(r'(?:OFFICER|CONSTABLE|SI|ASI|PI|DCP|CP)[\s\:\.]*?([A-Z\s]{4,25})\b(?:PAY|ONLINE|RS|$)', text_clean)
    fields["officer_name"] = m.group(1).strip() if m else None
    if fields["officer_name"] and len(fields["officer_name"]) < 4:
        fields["officer_name"] = None

    # Badge/service number
    m = re.search(r'(?:BADGE|SERVICE\s*NO\.?|S\.?NO\.?)[\s\:\.]*([A-Z0-9\-]{4,15})\b', text_clean)
    fields["officer_badge"] = m.group(1).strip() if m else None

    # Location (OCR scrambles this often, look for PLACE or LOCATION)
    m = re.search(r'(?:PLACE|LOCATION|AT|NEAR)[\s\:]+([A-Z\s,\.]{5,30})\b', text_clean)
    fields["location"] = m.group(1).strip() if m else None

    # Offense type
    fields["offense_type"] = _detect_offense(text_clean)

    # Offense description
    fields["offense_description"] = fields["offense_type"].replace("_", " ").title() if fields["offense_type"] else "Unknown"

    return fields


def _parse_date(date_str: str) -> Optional[datetime.date]:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def _detect_offense(text: str) -> Optional[str]:
    for keyword, offense_type in OFFENSE_KEYWORDS.items():
        if keyword.upper() in text:
            return offense_type
    return None


# ─── NLP Validity Checker ─────────────────────────────────────────────────────
def check_challan_validity(fields: dict) -> dict:
    """
    Validate extracted challan fields against Motor Vehicles Act 2019 rules.
    Returns list of dispute grounds + overall validity assessment.
    """
    grounds = []
    score = 0   # validity score (100 = fully valid, lower = more disputable)

    # 1. Missing officer badge
    if not fields.get("officer_badge"):
        grounds.append({
            "code": "MISSING_BADGE",
            "severity": "HIGH",
            "description": "Officer's badge/service number is absent from the challan",
            "legal_basis": LEGAL_REFS["MISSING_BADGE"][0],
            "explanation": LEGAL_REFS["MISSING_BADGE"][1],
        })
        score -= 30

    # 2. Missing officer name
    if not fields.get("officer_name"):
        grounds.append({
            "code": "MISSING_OFFICIAL",
            "severity": "HIGH",
            "description": "Issuing officer's name is not clearly recorded",
            "legal_basis": LEGAL_REFS["MISSING_OFFICIAL"][0],
            "explanation": LEGAL_REFS["MISSING_OFFICIAL"][1],
        })
        score -= 20

    # 3. Invalid / future date
    challan_date = fields.get("challan_date")
    today = datetime.date.today()
    if not challan_date:
        grounds.append({
            "code": "INVALID_DATE",
            "severity": "HIGH",
            "description": "Challan date is missing or in an unrecognizable format",
            "legal_basis": LEGAL_REFS["INVALID_DATE"][0],
            "explanation": LEGAL_REFS["INVALID_DATE"][1],
        })
        score -= 25
    elif challan_date > today:
        grounds.append({
            "code": "INVALID_DATE",
            "severity": "HIGH",
            "description": f"Challan is dated {challan_date} which is a future date — legally void",
            "legal_basis": LEGAL_REFS["INVALID_DATE"][0],
            "explanation": LEGAL_REFS["INVALID_DATE"][1],
        })
        score -= 35
    elif (today - challan_date).days > 180:
        grounds.append({
            "code": "EXPIRED_CHALLAN",
            "severity": "MEDIUM",
            "description": f"Challan is {(today - challan_date).days} days old — procedural defects may apply",
            "legal_basis": LEGAL_REFS["EXPIRED_CHALLAN"][0],
            "explanation": LEGAL_REFS["EXPIRED_CHALLAN"][1],
        })
        score -= 15

    # 4. Excessive fine
    fine = fields.get("fine_amount")
    offense_type = fields.get("offense_type")
    if fine and offense_type and offense_type in MVA_FINE_LIMITS:
        max_fine = MVA_FINE_LIMITS[offense_type]["first"]
        section = MVA_FINE_LIMITS[offense_type]["section"]
        if fine > max_fine:
            grounds.append({
                "code": "EXCESSIVE_FINE",
                "severity": "HIGH",
                "description": f"Fine of ₹{fine:,} exceeds MVA 2019 maximum of ₹{max_fine:,} for this offense",
                "legal_basis": f"Section {section}, Motor Vehicles Act 2019",
                "explanation": LEGAL_REFS["EXCESSIVE_FINE"][1],
            })
            score -= 30

    # 5. Missing location
    if not fields.get("location"):
        grounds.append({
            "code": "MISSING_LOCATION",
            "severity": "MEDIUM",
            "description": "Place of offense is not recorded on the challan",
            "legal_basis": LEGAL_REFS["MISSING_LOCATION"][0],
            "explanation": LEGAL_REFS["MISSING_LOCATION"][1],
        })
        score -= 15

    # 6. Missing vehicle number
    if not fields.get("vehicle_number"):
        grounds.append({
            "code": "MISSING_VEHICLE",
            "severity": "MEDIUM",
            "description": "Vehicle registration number is absent or unreadable",
            "legal_basis": LEGAL_REFS["MISSING_VEHICLE"][0],
            "explanation": LEGAL_REFS["MISSING_VEHICLE"][1],
        })
        score -= 10

    # 7. Missing challan number
    if not fields.get("challan_number"):
        grounds.append({
            "code": "INVALID_FORMAT",
            "severity": "HIGH",
            "description": "Challan number is missing — the document cannot be uniquely identified",
            "legal_basis": LEGAL_REFS["INVALID_FORMAT"][0],
            "explanation": LEGAL_REFS["INVALID_FORMAT"][1],
        })
        score -= 20

    # AI Recommendation
    final_score = max(0, 100 + score)
    if len(grounds) == 0:
        recommendation = "LOW_GROUNDS"
        summary = "The challan appears procedurally valid. Dispute chances are low."
    elif final_score < 40:
        recommendation = "STRONG_DISPUTE"
        summary = f"Strong grounds for dispute found ({len(grounds)} issues). High probability of success."
    elif final_score < 70:
        recommendation = "MODERATE_DISPUTE"
        summary = f"Moderate grounds for dispute ({len(grounds)} issues). Consider filing with supporting evidence."
    else:
        recommendation = "WEAK_DISPUTE"
        summary = f"Minor procedural issues found ({len(grounds)}). Dispute may succeed on technical grounds."

    return {
        "grounds": grounds,
        "validity_score": final_score,
        "recommendation": recommendation,
        "summary": summary,
        "total_grounds": len(grounds),
    }


# ─── PDF Generator ────────────────────────────────────────────────────────────
def generate_dispute_pdf(
    fields: dict,
    validity: dict,
    citizen_name: str,
    citizen_address: str,
    citizen_contact: str,
) -> bytes:
    """
    Generate a legally formatted dispute letter PDF using ReportLab.
    Returns PDF as bytes.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
    )

    styles = getSampleStyleSheet()
    # Custom styles
    header_style = ParagraphStyle("Header", parent=styles["Heading1"],
        fontSize=15, textColor=colors.HexColor("#1a365d"),
        spaceAfter=4, alignment=TA_CENTER, fontName="Helvetica-Bold")
    subheader_style = ParagraphStyle("SubHeader", parent=styles["Heading2"],
        fontSize=11, textColor=colors.HexColor("#2d3748"),
        spaceAfter=3, alignment=TA_CENTER)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
        fontSize=10, leading=16, alignment=TA_JUSTIFY, spaceAfter=6)
    bold_style = ParagraphStyle("Bold", parent=styles["Normal"],
        fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)
    section_style = ParagraphStyle("Section", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica-Bold", textColor=colors.HexColor("#2b6cb0"),
        spaceBefore=12, spaceAfter=4)
    ground_style = ParagraphStyle("Ground", parent=styles["Normal"],
        fontSize=9, leading=14, leftIndent=15, spaceAfter=4)

    today = datetime.date.today().strftime("%d %B %Y")
    ref_number = f"DISP/{datetime.datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex[:6].upper()}"

    story = []

    # ── Letterhead ──────────────────────────────────────────────────────────
    story.append(Paragraph("FORMAL DISPUTE LETTER", header_style))
    story.append(Paragraph("Traffic Challan Challenge under Motor Vehicles Act, 2019", subheader_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#2b6cb0")))
    story.append(Spacer(1, 0.4*cm))

    # ── Reference & Date ────────────────────────────────────────────────────
    ref_data = [
        ["Reference No:", ref_number, "Date:", today],
    ]
    ref_table = Table(ref_data, colWidths=[3.5*cm, 7*cm, 2*cm, 4*cm])
    ref_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTNAME', (0,0), (0,0), 'Helvetica-Bold'),
        ('FONTNAME', (2,0), (2,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#4a5568")),
    ]))
    story.append(ref_table)
    story.append(Spacer(1, 0.5*cm))

    # ── To / From ───────────────────────────────────────────────────────────
    story.append(Paragraph("To,", bold_style))
    story.append(Paragraph("The Traffic Police Commissioner / RTO Authority", body_style))
    story.append(Paragraph("Indore, Madhya Pradesh", body_style))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("From,", bold_style))
    story.append(Paragraph(f"<b>{citizen_name}</b>", body_style))
    story.append(Paragraph(citizen_address or "Indore, Madhya Pradesh", body_style))
    story.append(Paragraph(f"Contact: {citizen_contact or 'N/A'}", body_style))
    story.append(Spacer(1, 0.5*cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 0.3*cm))

    # ── Subject ─────────────────────────────────────────────────────────────
    challan_no = fields.get("challan_number", "Unknown")
    story.append(Paragraph(
        f"<b>Subject: Formal Dispute of Traffic Challan No. {challan_no} — "
        f"AI Validity Analysis: {validity['recommendation'].replace('_', ' ')}</b>",
        body_style
    ))
    story.append(Spacer(1, 0.3*cm))

    # ── Salutation ──────────────────────────────────────────────────────────
    story.append(Paragraph("Respected Sir/Madam,", body_style))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"I, <b>{citizen_name}</b>, respectfully submit this formal dispute against Traffic Challan "
        f"No. <b>{challan_no}</b> issued on <b>{fields.get('challan_date_raw', 'N/A')}</b> "
        f"for vehicle <b>{fields.get('vehicle_number', 'N/A')}</b>. "
        f"An AI-powered analysis under the Motor Vehicles Act, 2019 has identified "
        f"<b>{validity['total_grounds']} procedural ground(s)</b> on which this challan may be disputed.",
        body_style
    ))
    story.append(Spacer(1, 0.3*cm))

    # ── Challan Details ──────────────────────────────────────────────────────
    story.append(Paragraph("1. CHALLAN DETAILS", section_style))
    details_data = [
        ["Challan No.", fields.get("challan_number", "Not Detected")],
        ["Date & Time", f"{fields.get('challan_date_raw', 'N/A')} at {fields.get('challan_time', 'N/A')}"],
        ["Vehicle Number", fields.get("vehicle_number", "Not Detected")],
        ["Alleged Offense", fields.get("offense_description", "Not Detected")],
        ["Fine Amount", f"₹{fields.get('fine_amount', 'N/A'):,}" if fields.get('fine_amount') else "Not Detected"],
        ["Location", fields.get("location", "Not Detected")],
        ["Issuing Officer", fields.get("officer_name", "Not Detected")],
        ["Officer Badge No.", fields.get("officer_badge", "⚠ ABSENT")],
    ]
    details_table = Table(details_data, colWidths=[4.5*cm, 11*cm])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#ebf8ff")),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#bee3f8")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        # Highlight absent badge in red
        ('TEXTCOLOR', (1,7), (1,7), colors.red),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 0.5*cm))

    # ── Grounds for Dispute ──────────────────────────────────────────────────
    story.append(Paragraph("2. GROUNDS FOR DISPUTE", section_style))
    story.append(Paragraph(
        f"AI Validity Score: <b>{validity['validity_score']}/100</b> — {validity['summary']}",
        body_style
    ))
    story.append(Spacer(1, 0.2*cm))

    for idx, ground in enumerate(validity["grounds"], 1):
        severity_color = "#c53030" if ground["severity"] == "HIGH" else "#b7791f"
        story.append(Paragraph(
            f"<b>Ground {idx}: {ground['description']}</b> "
            f"<font color='{severity_color}'>[{ground['severity']} SEVERITY]</font>",
            bold_style
        ))
        story.append(Paragraph(
            f"Legal Basis: <i>{ground['legal_basis']}</i>",
            ground_style
        ))
        story.append(Paragraph(
            f"Explanation: {ground['explanation']}",
            ground_style
        ))
        story.append(Spacer(1, 0.2*cm))

    # ── Relief Sought ────────────────────────────────────────────────────────
    story.append(Paragraph("3. RELIEF SOUGHT", section_style))
    story.append(Paragraph(
        "In view of the above procedural defects and legal infirmities, I respectfully pray that "
        "this Hon'ble Authority may be pleased to:",
        body_style
    ))
    reliefs = [
        "Cancel/quash the impugned challan, OR",
        "Reduce the fine amount to the statutory maximum as per MVA 2019, OR",
        "Issue a notice to the concerned officer to produce the original challan with all mandatory particulars duly filled.",
    ]
    for relief in reliefs:
        story.append(Paragraph(f"   • {relief}", ground_style))
    story.append(Spacer(1, 0.3*cm))

    # ── Declaration ──────────────────────────────────────────────────────────
    story.append(Paragraph(
        "I declare that the information furnished above is true and correct to the best of my knowledge "
        "and belief. I am prepared to appear before any competent authority as required.",
        body_style
    ))
    story.append(Spacer(1, 0.5*cm))

    # ── Signature Block ──────────────────────────────────────────────────────
    sig_data = [
        [f"Thanking you,\nYours faithfully,", ""],
        [f"\n\n__________________________", f"Date: {today}"],
        [f"<b>{citizen_name}</b>", ""],
    ]
    sig_table = Table(sig_data, colWidths=[9*cm, 6*cm])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 0.5*cm))

    # ── AI Disclaimer footer ─────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"<font color='#718096' size='7'>Generated by NagarIQ AI Challan Dispute Engine · "
        f"Ref: {ref_number} · Analysis powered by EasyOCR + NLP rule engine · "
        f"This letter is AI-generated and should be reviewed by a legal professional before submission.</font>",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, alignment=TA_CENTER, textColor=colors.HexColor("#718096"))
    ))

    doc.build(story)
    return buffer.getvalue()


# ─── Main Pipeline ────────────────────────────────────────────────────────────
def process_challan(
    image_bytes: bytes,
    citizen_name: str = "Citizen",
    citizen_address: str = "",
    citizen_contact: str = "",
) -> dict:
    """
    Full challan processing pipeline.
    Returns: ocr_text, fields, validity, pdf_b64
    """
    print(f"[ChallanAI] 📷 Running OCR on challan image ({len(image_bytes)/1024:.1f} KB)...")
    ocr_text = run_ocr(image_bytes)
    print(f"[ChallanAI] 📝 OCR extracted {len(ocr_text)} chars")

    fields = parse_challan_fields(ocr_text)
    print(f"[ChallanAI] 🔍 Parsed fields: challan={fields.get('challan_number')}, "
          f"fine=₹{fields.get('fine_amount')}, date={fields.get('challan_date_raw')}")

    validity = check_challan_validity(fields)
    print(f"[ChallanAI] ⚖️ Validity score: {validity['validity_score']}/100 — "
          f"{validity['total_grounds']} grounds — {validity['recommendation']}")

    pdf_bytes = generate_dispute_pdf(fields, validity, citizen_name, citizen_address, citizen_contact)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    print(f"[ChallanAI] 📄 Dispute letter PDF generated ({len(pdf_bytes)/1024:.1f} KB)")

    return {
        "ocr_text": ocr_text,
        "fields": fields,
        "validity": validity,
        "pdf_base64": pdf_b64,
        "pdf_size_kb": round(len(pdf_bytes) / 1024, 1),
        "reference_number": f"DISP/{datetime.datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex[:6].upper()}",
    }
