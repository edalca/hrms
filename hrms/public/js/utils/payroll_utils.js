const global_variables = [
	"int", "float", "long", "round", "rounded",
	"date", "getdate", "get_first_day", "get_last_day",
	"ceil", "floor","date_diff","min","bonus(start_date, end_date, days, amount)"
];

hrms.payroll_utils = {
	set_autocompletions_for_condition_and_formula: function (frm, child_row = "") {
		const autocompletions = [];
		frappe.run_serially([
			...["Employee", "Salary Structure", "Salary Structure Assignment", "Salary Slip"].map(
				(doctype) =>
					frappe.model.with_doctype(doctype, () => {
						autocompletions.push(
							...hrms.get_doctype_fields_for_autocompletion(doctype),
						);
					}),
			),
			() => {
				global_variables.forEach((variable) => {
					autocompletions.push({
						value: variable,
						score: 10,  // Prioridad alta en autocompletación
						meta: __("Global Variable"),
					});
				})
			},
			() => {
				frappe.db
					.get_list("Salary Component", {
						fields: ["salary_component_abbr"],
					})
					.then((salary_components) => {
						autocompletions.push(
							...salary_components.map((d) => ({
								value: d.salary_component_abbr,
								score: 9,
								meta: __("Salary Component"),
							})),
						);

						autocompletions.push(
							...["base", "variable"].map((d) => ({
								value: d,
								score: 10,
								meta: __("Salary Structure Assignment field"),
							})),
						);

						if (child_row) {
							["condition", "formula"].forEach((field) => {
								frm.set_df_property(
									child_row.parentfield,
									"autocompletions",
									autocompletions,
									frm.doc.name,
									field,
									child_row.name,
								);
							});

							frm.refresh_field(child_row.parentfield);
						} else {
							["condition", "formula"].forEach((field) => {
								frm.set_df_property(field, "autocompletions", autocompletions);
							});
						}
					});
			},
		]);
	},
};
