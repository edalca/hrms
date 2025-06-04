frappe.listview_settings["Additional Salary"] = {
	get_indicator: function (doc) {
		if (doc.docstatus === 0) {
			return [__("Draft"), "red", "docstatus,=,0"];
		}
		if (doc.docstatus === 2) {
			return [__("Cancelled"), "grey", "docstatus,=,2"];
		}
		return doc.disabled
			? [__("Disabled"), "grey", "disabled,=,1"]
			: [__("Enabled"), "blue", "disabled,=,0"];
	},
};
