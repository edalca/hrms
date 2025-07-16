frappe.pages['salary-structure-man'].on_page_load = function (wrapper) {
	frappe.salary_structure_manager = new SalaryStructureManager(wrapper);
	$(wrapper).on("show", () => {
		let company = frappe.get_route()[1];
		frappe.salary_structure_manager.show(company);
	})
};

class SalaryStructureManager {
	constructor(parent) {
		this.page = frappe.ui.make_app_page({
			parent: parent,
			title: __('Salary Structure Manager'),
			single_column: false,
			card_layout: true,
		});
		this.pagination = {
			page_length: 15,
			start: 0,
		};

		this.parent = parent;
		this.page = this.parent.page;
		this.page.sidebar.html(
			`<ul class="standard-sidebar salary-structure-manager-sidebar overlay-sidebar"></ul>`
		);
		this.$sidebar_list = this.page.sidebar.find("ul");
		this.setup()

	}
	setup() {
		this.companies = []
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Company',
				fields: ['name', "abbr"]
			},
			callback: (r) => {
				this.companies = r.message || [];

				const _initial_company = frappe.get_route()[1] || this.companies[0].name;
				this.options = {
					selected_company: _initial_company,
					selected_employee: null,
					selected_employment_type: null,
				}

				this.message = null;
				this.setup_filters();
				this.setup_columns_fields()
				this.setup_buttons();
				this.make();
			}
		});

	}

	make() {
		this.$container = $(this.page.main);
		$(`<div class="frappe-list"></div>`).appendTo(this.$container);

		this.companies.forEach(company => {
			this.get_sidebar_item(company, "projects").appendTo(this.$sidebar_list);
		});
		this.render_selected_company();
		let company = this.options.selected_company
		this.show(company)
		this.get_list_view();
	}

	setup_filters() {
		this.employee_filter = this.page.add_field({
			fieldtype: 'Link',
			fieldname: 'employee',
			label: __('Employee'),
			options: 'Employee',
			change: () => {
				this.options.selected_employee = this.employee_filter.value;
				this.get_list_view();
			}
		});

		this.employment_type_filter = this.page.add_field({
			fieldtype: 'Link',
			fieldname: 'employment_type',
			label: __('Employment Type'),
			options: 'Employment Type',
			change: () => {
				this.options.selected_employment_type = this.employment_type_filter.value;
				this.get_list_view();
			}
		});

	}

	setup_columns_fields() {
		this.fields = [{
			fieldname: "employee",
			fieldtype: "Link",
			options: "Employee",
			label: __("Employee"),
		},
		{
			fieldname: "employee_name",
			fieldtype: "Data",
			label: __("Employee Name")
		}, {
			fieldname: "salary_structure",
			fieldtype: "Link",
			options: "Salary Structure",
			label: __("Salary Structure")
		}, {
			fieldname: "base",
			fieldtype: "Currency",
			label: __("Base")
		}, {
			fieldname: "variable",
			fieldtype: "Currency",
			label: __("Variable")
		}, {
			fieldname: "from_date",
			fieldtype: "Date",
			label: __("From Date")
		}];
	}
	setup_buttons() {
		this.page.set_primary_action(__('Add') + " " + __('Salary Structure Assignment'), () => { }, "add");
	}

	render_selected_company() {
		this.$sidebar_list.on("click", "li", (e) => {
			let $li = $(e.currentTarget);
			let company = $li.find(".company-text").attr("company-value");

			this.options.selected_company = company;
			this.$sidebar_list.find("li").removeClass("active selected");
			$li.addClass("active selected");
			this.pagination.start = 0; // Reset pagination on company change
			this.get_list_view();
		})
	}
	get_list_view() {
		let me = this;
		frappe.call({
			method: 'hrms.payroll.page.salary_structure_man.salary_structure_man.get_latest_salary_structure_assignments',
			args: {
				company: this.options.selected_company,
				filters: {
					employee: this.options.selected_employee || null,
					employment_type: this.options.selected_employment_type || null,
				},
				limit_start: this.pagination.start,
				limit_page_length: this.pagination.page_length

			},
			callback: function (r) {
				const result = r.message;
				if (result) {
					me.total_count = result.total_count || 0;
					(me.render_list_view(result.data));
					me.render_list_view(result.data);
					me.render_list_view_pagination();
				}
			}
		});
	}
	render_list_view(items = []) {
		var html = `${this.render_list_view_no_results()}
			<div class="result" style="${this.message ? "display: none;" : ""}">
				${this.render_list_view_result(items)}
			</div>`;
		this.$container.find(".frappe-list").html(html);

	}
	render_list_view_pagination() {
		const total_items = this.total_count || 0;
		const page_length = this.pagination.page_length;
		const total_pages = Math.ceil(total_items / page_length);
		const current_page = Math.floor(this.pagination.start / page_length) + 1;
		const $nav = $(`<div class="list-paging-area flex justify-center gap-1"></div>`);
		// Rango de botones visibles
		const max_visible = 5;
		let start_page = Math.max(1, current_page - Math.floor(max_visible / 2));
		let end_page = Math.min(total_pages, start_page + max_visible - 1);
		if (end_page - start_page < max_visible - 1) {
			start_page = Math.max(1, end_page - max_visible + 1);
		}
		$nav.append(this.create_page_button(__("First"), 1));
		// Elipsis antes
		if (start_page > 1) {
			$nav.append(`<span class="text-muted px-1">...</span>`);
		}

		for (let i = start_page; i <= end_page; i++) {
			$nav.append(this.create_page_button(i, i, i === current_page));
		}

		// Elipsis después
		if (end_page < total_pages) {
			$nav.append(`<span class="text-muted px-1">...</span>`);
		}

		// Botón "»" para ir a la última página
		$nav.append(this.create_page_button(__("Last"), total_pages));
		this.$container.find(".list-paging-area").remove();
		this.$container.append($nav);
	}

	create_page_button(label, page, is_active = false) {
		const btn_class = is_active ? "btn-primary" : "btn-default";
		const $btn = $(`<button class="btn btn-sm ${btn_class}">${label}</button>`);
		$btn.on("click", () => {
			this.pagination.start = (page - 1) * this.pagination.page_length;
			this.get_list_view();
		});
		return $btn;
	}

	render_list_view_result(items) {
		var html = `${this.render_list_view_header()}
			${this.render_list_view_body(items)}`;
		return html;
	}
	render_list_view_header() {
		const headers = this.fields
			.map((field, index) => {
				return `<div class="list-row-col ellipsis"
					style="${index == 0 ? "margin-left: 20px;" : ""}">
					<span >
						${field.label || frappe.model.unscrub(field.fieldname)}
					</span>
				</div>`;
			})
			.join("");

		return `<header class="level list-row-head text-muted">
				<div class="level-left list-header-subject">${headers}</div>

  			</header>`;
	}

	render_list_view_body(items) {
		const body = items.map((item, index) => {
			const $row_container = $(this.render_row_container(item, index + 1));
			const $rows_container = $(`<div class="level-left ellipsis">`).append($row_container);

			return `
			<div class="list-row-container" tabindex="1">
				<div class="level list-row">
					${$rows_container[0].outerHTML}
				</div>
				<div class="list-row-border"></div>
			</div>
		`;
		}).join("");

		return body;
	}

	render_list_view_no_results() {
		const display_class = this.message ? "" : "hide";
		return `<div class="salary-structure-manager-empty-state ${display_class}">
  			<div class="no-result text-center">
  				<img src="/assets/frappe/images/ui-states/search-empty-state.svg"
  					alt="Empty State"
  					class="null-state"
  				>
  				<div class="empty-state-text">${this.message}</div>
  			</div>
  		</div>`;
	}
	render_row_container(item, index) {
		const row = this.fields
			.map((field, index) => {
				return `<div class="list-row-col ellipsis">
					${this.render_cell(field, item[field.fieldname]) || ""}
				</div>`;
			})
			.join("");
		return row
	}

	render_cell(field, value) {
		switch (field.fieldtype) {
			case "Link":
				return `<a class="ellipsis" href="${frappe.utils.get_form_link(field.options,value)}" title="${field.label + ": " + value}">
					${value || ""}
				</a>`;
			case "Data":
				return `<span class="ellipsis" title="${field.label + ": " + value}">${value || ""}</span>`;
			case "Currency":
				return `<span class="ellipsis" title="${field.label + ": " + value}">${format_currency(value)}</span>`;
			case "Date":
				return `<span class="ellipsis" title="${field.label + ": " + value}">${frappe.datetime.str_to_user(value)}</span>`;
			default:
				return `<span class="ellipsis" title="${field.label + ": " + value}">${value || ""}</span>`;
		}

	}
	get_sidebar_item(item, icon) {
		let icon_html = icon ? frappe.utils.icon(icon, "md") : "";
		return $(`<li class="standard-sidebar-item">
			<span>${icon_html}</span>
			<a class="sidebar-link">
				<span class="company-text" title="${item.name}" company-value="${item.name}">${__(item.name)}</span>
			</a>
		</li>`);
	}

	show(company) {
		if (this.companies.length) {

			if (this.companies.find(companies => companies.name == company)) {
				this.options.selected_company = company;
				this.$sidebar_list.find(`[company-value="${this.options.selected_company}"]`).trigger("click");
			}
		}
	}

}
