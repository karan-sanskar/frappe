import { test, expect } from "../support";

const DOCTYPE = "If Owner Perm Test";
const ROLE = "Blogger";

const checkbox = (page, if_owner, ptype) =>
	page
		.locator("tr", { has: page.locator(`[data-role="${ROLE}"]`) })
		.filter({
			has: page.locator(
				`input[data-ptype="if_owner"]${if_owner ? ":checked" : ":not(:checked)"}`
			),
		})
		.locator(`input[data-ptype="${ptype}"]`);

const saved_rules = async (api) => {
	const res = await api.call(
		"frappe.core.page.permission_manager.permission_manager.get_permissions",
		{
			doctype: DOCTYPE,
		}
	);
	return res.message
		.map((d) => ({ if_owner: d.if_owner, read: d.read, write: d.write }))
		.sort((a, b) => a.if_owner - b.if_owner);
};

const tick = async (page, input) => {
	const saved = page.waitForResponse(
		(res) =>
			res.url().includes("permission_manager.update") && res.request().method() === "POST"
	);
	await input.check();
	expect((await saved).ok()).toBe(true);
};

test.describe("Role Permissions Manager", () => {
	test("ticking a permission on an 'Only if Creator' rule leaves the other rule alone", async ({
		page,
		api,
	}) => {
		await api.call("frappe.tests.ui_test_helpers.setup_if_owner_permission_doctype", {
			name: DOCTYPE,
			rules: JSON.stringify([
				{ role: ROLE, permlevel: 0, if_owner: 0, read: 1, write: 0 },
				{ role: ROLE, permlevel: 0, if_owner: 1, read: 1, write: 0 },
			]),
		});

		await page.goto(`/desk/permission-manager/${DOCTYPE}`);
		await expect(page.locator("input[data-ptype='if_owner']")).toHaveCount(2);

		const write = checkbox(page, true, "write");
		await tick(page, write);

		expect(await saved_rules(api)).toEqual([
			{ if_owner: 0, read: 1, write: 0 },
			{ if_owner: 1, read: 1, write: 1 },
		]);
	});

	test("saves a permission ticked right after toggling 'Only if Creator'", async ({
		page,
		api,
	}) => {
		await api.call("frappe.tests.ui_test_helpers.setup_if_owner_permission_doctype", {
			name: DOCTYPE,
			rules: JSON.stringify([{ role: ROLE, permlevel: 0, if_owner: 0, read: 1, write: 0 }]),
		});

		await page.goto(`/desk/permission-manager/${DOCTYPE}`);
		await expect(page.locator("input[data-ptype='if_owner']")).toHaveCount(1);

		const if_owner = page.locator("input[data-ptype='if_owner']");
		await tick(page, if_owner);

		const write = page.locator("input[data-ptype='write']");
		await tick(page, write);

		expect(await saved_rules(api)).toEqual([{ if_owner: 1, read: 1, write: 1 }]);
	});
});
