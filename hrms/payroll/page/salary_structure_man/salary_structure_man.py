import frappe
from frappe import _
from pypika.functions import Max,Count
from frappe.query_builder import DocType
import json

@frappe.whitelist()
def get_latest_salary_structure_assignments(company, filters=None, limit_start=0, limit_page_length=20):


    ssa = DocType("Salary Structure Assignment")
    emp = DocType("Employee")

    if isinstance(filters, str):
        filters = json.loads(filters)

    base_conditions = (
        (ssa.docstatus == 1) &
        (ssa.company == company) &
        (emp.status == "Active")
    )

    if filters:
        if filters.get("employee"):
            base_conditions &= (ssa.employee == filters["employee"])
        if filters.get("employment_type"):
            base_conditions &= (emp.employment_type == filters["employment_type"])

    # Subconsulta para conteo total
    subquery = (
        frappe.qb.from_(ssa)
        .join(emp).on(ssa.employee == emp.name)
        .select(ssa.employee)
        .where(base_conditions)
        .groupby(ssa.employee)
    )

    total_count = frappe.qb.from_(subquery).select(Count("*")).run()[0][0]

    # Consulta principal con datos paginados
    query = (
        frappe.qb.from_(ssa)
        .join(emp).on(ssa.employee == emp.name)
        .select(
            ssa.employee,
            emp.employee_name,
            ssa.salary_structure,
            ssa.base,
            ssa.variable,
            Max(ssa.from_date).as_("from_date")
        )
        .where(base_conditions)
        .groupby(ssa.employee)
        .limit(limit_page_length)
        .offset(limit_start)
    )

    result = query.run(as_dict=True)

    return {
        "data": result,
        "total_count": total_count
    }
