frappe.ui.form.on("Employee Attendance Tool", {
	refresh(frm) {
		frm.disable_save();
		frm.trigger("set_primary_action");
	},

	onload(frm) {
		if (!frm.doc.from_date) frm.set_value("from_date", frappe.datetime.get_today());
		if (!frm.doc.to_date) frm.set_value("to_date", frappe.datetime.get_today());
	},

	fetch_employees(frm) {
		frm.trigger("validate_and_load");
	},

	validate_and_load(frm) {
		if (!frm.doc.from_date || !frm.doc.to_date) {
			frappe.msgprint(__("Please select the date range."));
			return;
		}
		let diff = frappe.datetime.get_diff(frm.doc.to_date, frm.doc.from_date);
		if (diff < 0 || diff >= 7) {
			frappe.throw(__("The range must be between 1 and 7 days."));
			return;
		}
		frm.trigger("load_attendance_grid");
	},

	load_attendance_grid(frm) {
		frappe.call({
			method: "hrms.hr.doctype.employee_attendance_tool.employee_attendance_tool.get_employees",
			args: {
				from_date: frm.doc.from_date,
				to_date: frm.doc.to_date,
				department: frm.doc.department,
				branch: frm.doc.branch,
				company: frm.doc.company,
			},
			freeze: true,
			callback: (r) => {
				if (r.message) frm.events.render_grid(frm, r.message);
			}
		});
	},

	render_grid(frm, data) {
		const field = frm.get_field("employees_html");
		if (!field) return;

		// Forzar visibilidad
		if (field.parent_section) field.parent_section.show();
		frm.set_df_property("employees_html", "hidden", 0);

		const $wrapper = field.$wrapper;
		$wrapper.empty();

		let dates = [];
		let current = moment(frm.doc.from_date);
		let end = moment(frm.doc.to_date);
		while (current <= end) {
			dates.push(current.format("YYYY-MM-DD"));
			current.add(1, 'days');
		}

		// Contenedor con Scroll (Aproximadamente 450px para 10 filas)
		let table_html = `
        <div class="attendance-scroll-container" style="
            max-height: 450px; 
            overflow-y: auto; 
            overflow-x: auto; 
            background: white;
        ">
            <table class="table table-bordered table-condensed" style="margin: 0; border: none;">
                <thead>
                    <tr style="position: sticky; top: 0; background: #f8f9fa; z-index: 10;">
                        <th style="width: 30%; background: #f8f9fa; border-top: none;">${__("Employee")}</th>
                        ${dates.map(d => `
                            <th class="text-center" style="background: #f8f9fa; border-top: none; min-width: 85px;">
								<div style="font-size: 11px; text-transform: capitalize;">
									${__(moment(d).format('dddd')).substring(0, 3)}, ${moment(d).format('DD')} ${__(moment(d).format('MMMM')).substring(0, 3)}
								</div>
                                <input type="checkbox" class="grid-select-all-day" data-date="${d}">
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.employees.map(emp => `
                        <tr>
                            <td style="background: white;">
                                <div style="font-weight: 500;">${emp.employee_name}</div>
                                <small class="text-muted">${emp.name}</small>
                            </td>
						${dates.map(d => {
			const employee_data = data.marked_dates[emp.name] || {};
			const status = employee_data[d];
			if (status) {
				// Definimos colores según el status
				let color_map = {
					"Present": "green",
					"Absent": "red",
					"Half Day": "orange",
					"On Leave": "#318AD8",
					"Work From Home": "green"
				};
				let color = color_map[status] || "gray";

				return `
									<td class="text-center" style="vertical-align: middle;">
										<span style="color: ${color}; font-weight: bold; font-size: 10px;">
											${__(status)}
										</span>
									</td>`;
			} else {
				return `
									<td class="text-center" style="vertical-align: middle;">
										<input type="checkbox" class="attendance-check" 
											data-employee="${emp.name}" data-date="${d}"
											style="cursor: pointer;">
									</td>`;
			}
		}).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

		$wrapper.html(table_html);
		frm.events.bind_grid_events(frm, $wrapper);
		frm.layout.refresh();
	},

	bind_grid_events(frm, $wrapper) {
		$wrapper.find('.grid-select-all-day').on('change', function () {
			let date = $(this).data('date');
			let checked = $(this).is(':checked');
			$wrapper.find(`.attendance-check[data-date="${date}"]`).prop('checked', checked);
		});
	},

	set_primary_action(frm) {
		frm.page.set_primary_action(__("Mark Attendance"), () => {
			let selected = [];
			frm.get_field("employees_html").$wrapper.find('.attendance-check:checked').each(function () {
				selected.push({ employee: $(this).data('employee'), date: $(this).data('date') });
			});

			if (!selected.length || !frm.doc.status) {
				frappe.throw(__("Select employees and status first."));
				return;
			}

			frappe.call({
				method: "hrms.hr.doctype.employee_attendance_tool.employee_attendance_tool.mark_employee_attendance_bulk",
				args: {
					attendance_data: selected,
					status: frm.doc.status,
					shift: frm.doc.shift
				},
				freeze: true,
				callback: () => {
					frappe.show_alert({ message: __("Success"), indicator: 'green' });
					frm.trigger("load_attendance_grid");
				}
			});
		});
	}
});