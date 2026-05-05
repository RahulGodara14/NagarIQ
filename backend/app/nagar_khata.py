"""
💰 NagarKhata — Unified Municipal Billing & Tax Portal
NagarIQ Smart City OS

Architecture:
  - Manages municipal bills: Property Tax, Water Tax, Garbage Collection Fee
  - Applies automatic NagarScore tier-based discounts
  - Processes mock UPI/NagrikPay payments
  - Generates digital receipts (stored in Nagrik Vault)
  - Tracks full payment history per citizen
"""

import uuid
import datetime
import random
from typing import List, Dict, Optional

# ─────────────────────────────────────────────
# TIER DISCOUNT TABLE (linked to NagarScore)
# ─────────────────────────────────────────────

TIER_DISCOUNTS = {
    "Platinum": 0.20,   # 20% discount
    "Gold":     0.10,   # 10% discount
    "Silver":   0.05,   #  5% discount
    "Bronze":   0.00,   #  0% discount
}

# ─────────────────────────────────────────────
# BILL CATALOG (Indore Municipal Corporation)
# ─────────────────────────────────────────────

BILL_TEMPLATES = [
    {
        "type": "property_tax",
        "label": "Property Tax",
        "icon": "🏠",
        "department": "Indore Municipal Corporation",
        "description": "Annual property tax for residential unit in Vijay Nagar ward",
        "base_amount": 4800,
        "due_cycle": "quarterly",  # due every quarter
    },
    {
        "type": "water_tax",
        "label": "Water & Sewerage Tax",
        "icon": "💧",
        "department": "IMC Water Works",
        "description": "Monthly water supply and sewerage treatment charges",
        "base_amount": 320,
        "due_cycle": "monthly",
    },
    {
        "type": "garbage_fee",
        "label": "Solid Waste Management",
        "icon": "🗑️",
        "department": "IMC SwachhBharat Cell",
        "description": "Monthly door-to-door garbage collection fee",
        "base_amount": 80,
        "due_cycle": "monthly",
    },
    {
        "type": "street_light",
        "label": "Street Light & Infrastructure",
        "icon": "💡",
        "department": "IMC Smart City Division",
        "description": "Annual smart city infrastructure maintenance levy",
        "base_amount": 600,
        "due_cycle": "annual",
    },
]

# ─────────────────────────────────────────────
# IN-MEMORY LEDGER (keyed by citizen_id)
# ─────────────────────────────────────────────

# bills[citizen_id] = list of bill dicts
_bills: Dict[str, List[dict]] = {}

# payments[citizen_id] = list of payment receipts
_payments: Dict[str, List[dict]] = {}


# ─────────────────────────────────────────────
# BILL GENERATION
# ─────────────────────────────────────────────

def _make_due_date(cycle: str) -> str:
    today = datetime.date.today()
    if cycle == "monthly":
        # Due on 15th of next month
        if today.month == 12:
            due = datetime.date(today.year + 1, 1, 15)
        else:
            due = datetime.date(today.year, today.month + 1, 15)
    elif cycle == "quarterly":
        # Due in 45 days
        due = today + datetime.timedelta(days=45)
    else:  # annual
        due = datetime.date(today.year + 1, 1, 31)
    return due.strftime("%d %b %Y")

def _is_overdue(due_date_str: str) -> bool:
    try:
        due = datetime.datetime.strptime(due_date_str, "%d %b %Y").date()
        return due < datetime.date.today()
    except Exception:
        return False

def get_citizen_bills(citizen_id: str, tier: str = "Bronze") -> List[dict]:
    """
    Returns the pending bills for a citizen.
    Auto-generates bills on first call (simulating fresh account).
    Applies NagarScore tier discount.
    """
    if citizen_id not in _bills:
        # First call — generate a fresh set of bills for this citizen
        _bills[citizen_id] = []
        discount_rate = TIER_DISCOUNTS.get(tier, 0.0)
        
        for template in BILL_TEMPLATES:
            # Add small random variance per citizen
            variance = random.randint(-50, 100)
            base = template["base_amount"] + variance
            discount_amt = round(base * discount_rate)
            final_amount = base - discount_amt
            
            bill = {
                "bill_id": f"BILL-{uuid.uuid4().hex[:8].upper()}",
                "citizen_id": citizen_id,
                "type": template["type"],
                "label": template["label"],
                "icon": template["icon"],
                "department": template["department"],
                "description": template["description"],
                "base_amount": base,
                "discount_rate_pct": int(discount_rate * 100),
                "discount_amount": discount_amt,
                "final_amount": final_amount,
                "due_date": _make_due_date(template["due_cycle"]),
                "status": "pending",  # pending | paid | overdue
                "payment_id": None,
            }
            # 20% chance any bill is overdue for realism
            if random.random() < 0.2:
                bill["due_date"] = (datetime.date.today() - datetime.timedelta(days=random.randint(1, 20))).strftime("%d %b %Y")
                bill["status"] = "overdue"
            _bills[citizen_id].append(bill)
    
    # Update overdue status dynamically
    for bill in _bills[citizen_id]:
        if bill["status"] == "pending" and _is_overdue(bill["due_date"]):
            bill["status"] = "overdue"
            
    return _bills[citizen_id]


# ─────────────────────────────────────────────
# PAYMENT PROCESSING
# ─────────────────────────────────────────────

def process_payment(citizen_id: str, bill_id: str, payment_method: str = "UPI") -> dict:
    """
    Processes a bill payment.
    Marks bill as paid, generates a digital receipt.
    """
    if citizen_id not in _bills:
        return {"status": "error", "message": "Citizen has no bills on record"}
    
    bill = next((b for b in _bills[citizen_id] if b["bill_id"] == bill_id), None)
    if not bill:
        return {"status": "error", "message": f"Bill {bill_id} not found"}
    if bill["status"] == "paid":
        return {"status": "error", "message": "Bill is already paid"}
    
    payment_id = f"RCP-{uuid.uuid4().hex[:10].upper()}"
    paid_at = datetime.datetime.now()
    
    # Mark the bill as paid
    bill["status"] = "paid"
    bill["payment_id"] = payment_id
    
    receipt = {
        "payment_id": payment_id,
        "bill_id": bill_id,
        "citizen_id": citizen_id,
        "bill_label": bill["label"],
        "amount_paid": bill["final_amount"],
        "discount_applied": bill["discount_amount"],
        "payment_method": payment_method,
        "upi_ref": f"UPI{random.randint(100000000000, 999999999999)}",
        "paid_at": paid_at.isoformat(),
        "paid_at_human": paid_at.strftime("%d %b %Y, %I:%M %p"),
        "department": bill["department"],
        "financial_year": f"FY {paid_at.year}-{str(paid_at.year + 1)[2:]}",
        # A receipt stored in vault would have this as a document
        "vault_doc": {
            "id": payment_id,
            "name": f"{bill['label']} Receipt",
            "issuer": bill["department"],
            "last_synced": paid_at.strftime("%d %b %Y"),
            "status": "verified",
        }
    }
    
    # Store in payment history
    if citizen_id not in _payments:
        _payments[citizen_id] = []
    _payments[citizen_id].insert(0, receipt)
    
    return {"status": "success", "receipt": receipt}


def get_payment_history(citizen_id: str) -> List[dict]:
    """Returns all past payment receipts for a citizen."""
    return _payments.get(citizen_id, [])


def get_bill_summary(citizen_id: str, tier: str = "Bronze") -> dict:
    """Returns an aggregated summary of a citizen's financial standing."""
    bills = get_citizen_bills(citizen_id, tier)
    pending = [b for b in bills if b["status"] == "pending"]
    overdue = [b for b in bills if b["status"] == "overdue"]
    paid = [b for b in bills if b["status"] == "paid"]
    
    total_pending = sum(b["final_amount"] for b in pending + overdue)
    total_discount_saved = sum(b["discount_amount"] for b in bills)
    total_paid = sum(b["final_amount"] for b in paid)
    
    return {
        "total_pending_amount": total_pending,
        "total_discount_saved": total_discount_saved,
        "total_paid_this_year": total_paid,
        "overdue_count": len(overdue),
        "pending_count": len(pending),
        "paid_count": len(paid),
        "tier_discount_pct": int(TIER_DISCOUNTS.get(tier, 0) * 100),
        "bills": bills,
    }
