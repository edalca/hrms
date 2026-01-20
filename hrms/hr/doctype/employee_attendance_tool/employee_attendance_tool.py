# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

class EmployeeAttendanceTool(Document):
    pass

@frappe.whitelist()
def get_employees(from_date, to_date, department=None, branch=None, company=None):
    """
    Returns the list of active employees and a mapping of dates 
    where attendance has already been recorded.
    """
    filters = {
        "status": "Active",
        "date_of_joining": ["<=", to_date]
    }

    if department: filters["department"] = department
    if branch: filters["branch"] = branch
    if company: filters["company"] = company

    employee_list = frappe.get_all(
        "Employee", 
        fields=["name", "employee_name"], 
        filters=filters, 
        order_by="employee_name"
    )

    if not employee_list:
        return {"employees": [], "marked_dates": {}}

    employee_ids = [e.name for e in employee_list]
    
    attendance_records = frappe.get_all(
        "Attendance",
        fields=["employee", "attendance_date","status"],
        filters={
            "employee": ["in", employee_ids],
            "attendance_date": ["between", [from_date, to_date]],
            "docstatus": ["<", 2]
        }
    )

    marked_dates = {emp.name: {} for emp in employee_list}
    
    for att in attendance_records:
        date_str = att.attendance_date.strftime("%Y-%m-%d")
        if att.employee in marked_dates:
            marked_dates[att.employee][date_str] = att.status

    return {
        "employees": employee_list,
        "marked_dates": marked_dates
    }

@frappe.whitelist()
def mark_employee_attendance_bulk(attendance_data, status, shift=None, late_entry=0, early_exit=0):
    """
    Creates Attendance documents for all selected cells in the grid.
    attendance_data: list of dicts [{"employee": "...", "date": "..."}]
    """
    if isinstance(attendance_data, str):
        attendance_data = json.loads(attendance_data)

    count = 0
    for entry in attendance_data:
        # Prevent double marking if the record already exists
        exists = frappe.db.exists("Attendance", {
            "employee": entry['employee'],
            "attendance_date": entry['date'],
            "docstatus": ["<", 2]
        })
        
        if not exists:
            attendance = frappe.new_doc("Attendance")
            attendance.update({
                "doctype": "Attendance",
                "employee": entry['employee'],
                "attendance_date": getdate(entry['date']),
                "status": status,
                "shift": shift,
                "late_entry": frappe.utils.cint(late_entry),
                "early_exit": frappe.utils.cint(early_exit)
            })
            attendance.insert()
            attendance.submit()
            count += 1
            
    return count