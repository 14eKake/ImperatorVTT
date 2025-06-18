import { EntitySheetHelper } from "./helper.js";

/**
 * Extend the base Item document to support attributes and groups with a custom template creation dialog.
 * @extends {Item}
 */
export class SimpleItem extends Item {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  /** @override */
  static async createDialog(data = {}, options = {}) {
    return EntitySheetHelper.createDialog.call(this, data, options);
  }

  /**
   * Indique si cet Item est utilisé comme template pour d'autres Items.
   * @type {boolean}
   */
  get isTemplate() {
    return !!this.getFlag("imperator", "isTemplate");
  }
}
