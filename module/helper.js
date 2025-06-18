export class EntitySheetHelper {

  static getAttributeData(data) {
    // Détermine le type des attributs.
    for ( let attr of Object.values(data.system.attributes) ) {
      if ( attr.dtype ) {
        attr.isCheckbox = attr.dtype === "Boolean";
        attr.isResource = attr.dtype === "Resource";
        attr.isFormula = attr.dtype === "Formula";
      }
    }

    // Initialiser les attributs non groupés
    data.system.ungroupedAttributes = {};

    // Construire un tableau des clés de groupes triées
    const groups = data.system.groups || {};
    let groupKeys = Object.keys(groups).sort((a, b) => {
      let aSort = groups[a].label ?? a;
      let bSort = groups[b].label ?? b;
      return aSort.localeCompare(bSort);
    });

    // Itérer sur chaque groupe pour y ajouter ses attributs
    for ( let key of groupKeys ) {
      let group = data.system.attributes[key] || {};
      if ( !data.system.groups[key]['attributes'] ) data.system.groups[key]['attributes'] = {};
      Object.keys(group).sort((a, b) => a.localeCompare(b)).forEach(attr => {
        if ( typeof group[attr] != "object" || !group[attr]) return;
        group[attr]['isCheckbox'] = group[attr]['dtype'] === 'Boolean';
        group[attr]['isResource'] = group[attr]['dtype'] === 'Resource';
        group[attr]['isFormula'] = group[attr]['dtype'] === 'Formula';
        data.system.groups[key]['attributes'][attr] = group[attr];
      });
    }

    // Les attributs restants
    const keys = Object.keys(data.system.attributes).filter(a => !groupKeys.includes(a));
    keys.sort((a, b) => a.localeCompare(b));
    for ( const key of keys ) data.system.ungroupedAttributes[key] = data.system.attributes[key];

    // Modifier les attributs sur les items
    if ( data.items ) {
      data.items.forEach(item => {
        for ( let [k, v] of Object.entries(item.system.attributes) ) {
          if ( !v.dtype ) {
            for ( let [gk, gv] of Object.entries(v) ) {
              if ( gv.dtype ) {
                if ( !gv.label ) gv.label = gk;
                gv.isFormula = gv.dtype === "Formula";
              }
            }
          } else {
            if ( !v.label ) v.label = k;
            v.isFormula = v.dtype === "Formula";
          }
        }
      });
    }
  }

  static onSubmit(event) {
    if ( event.currentTarget ) {
      if ( (event.currentTarget.tagName.toLowerCase() === 'input') && !event.currentTarget.hasAttribute('name')) {
        return false;
      }
      let attr = false;
      const el = event.currentTarget;
      if ( el.classList.contains("attribute-key") ) {
        let val = el.value;
        let oldVal = el.closest(".attribute").dataset.attribute;
        let attrError = false;
        let groups = document.querySelectorAll('.group-key');
        for ( let i = 0; i < groups.length; i++ ) {
          if (groups[i].value === val) {
            ui.notifications.error(game.i18n.localize("SIMPLE.NotifyAttrDuplicate") + ` (${val})`);
            el.value = oldVal;
            attrError = true;
            break;
          }
        }
        if ( !attrError ) {
          oldVal = oldVal.includes('.') ? oldVal.split('.')[1] : oldVal;
          attr = $(el).attr('name').replace(oldVal, val);
        }
      }
      return attr ? attr : true;
    }
  }

  static async onClickAttributeControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    switch ( action ) {
      case "create":
        return EntitySheetHelper.createAttribute(event, this);
      case "delete":
        return EntitySheetHelper.deleteAttribute(event, this);
    }
  }

  static async onClickAttributeGroupControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    switch ( action ) {
      case "create-group":
        return EntitySheetHelper.createAttributeGroup(event, this);
      case "delete-group":
        return EntitySheetHelper.deleteAttributeGroup(event, this);
    }
  }

  static onAttributeRoll(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const label = button.closest(".attribute").querySelector(".attribute-label")?.value;
    const chatLabel = label ?? button.parentElement.querySelector(".attribute-key").value;
    const shorthand = game.settings.get("imperator", "macroShorthand");
    const rollData = this.actor.getRollData();
    let formula = button.closest(".attribute").querySelector(".attribute-value")?.value;
    if ( formula ) {
      let replacement = null;
      if ( formula.includes('@item.') && this.item ) {
        let itemName = this.item.name.slugify({strict: true});
        replacement = shorthand ? `@items.${itemName}.` : `@items.${itemName}.attributes.`;
        formula = formula.replace('@item.', replacement);
      }
      let r = new Roll(formula, rollData);
      return r.toMessage({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `${chatLabel}`
      });
    }
  }

  static getAttributeHtml(items, index, group = false) {
    let result = '<div style="display: none;">';
    for (let [key, item] of Object.entries(items)) {
      result += `<input type="${item.type}" name="system.attributes${group ? '.' + group : ''}.attr${index}.${key}" value="${item.value}"/>`;
    }
    return result + '</div>';
  }

  static validateGroup(groupName, document) {
    let groups = Object.keys(document.system.groups || {});
    let attributes = Object.keys(document.system.attributes).filter(a => !groups.includes(a));
    if ( groups.includes(groupName) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupDuplicate") + ` (${groupName})`);
      return false;
    }
    if ( attributes.includes(groupName) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupAttrDuplicate") + ` (${groupName})`);
      return false;
    }
    if ( ["attr", "attributes"].includes(groupName) ) {
      ui.notifications.error(game.i18n.format("SIMPLE.NotifyGroupReserved", {key: groupName}));
      return false;
    }
    if ( groupName.match(/[\s|\.]/i) ) {
      ui.notifications.error(game.i18n.localize("SIMPLE.NotifyGroupAlphanumeric"));
      return false;
    }
    return true;
  }

  static async createAttribute(event, app) {
    const a = event.currentTarget;
    const group = a.dataset.group;
    let dtype = a.dataset.dtype;
    const attrs = app.object.system.attributes;
    const groups = app.object.system.groups;
    const form = app.form;
    let objKeys = Object.keys(attrs).filter(k => !Object.keys(groups).includes(k));
    let nk = Object.keys(attrs).length + 1;
    let newValue = `attr${nk}`;
    let newKey = document.createElement("div");
    while ( objKeys.includes(newValue) ) {
      ++nk;
      newValue = `attr${nk}`;
    }
    let htmlItems = {
      key: { type: "text", value: newValue }
    };
    if ( group ) {
      objKeys = attrs[group] ? Object.keys(attrs[group]) : [];
      nk = objKeys.length + 1;
      newValue = `attr${nk}`;
      while ( objKeys.includes(newValue) ) {
        ++nk;
        newValue =  `attr${nk}`;
      }
      htmlItems.key.value = newValue;
      htmlItems.group = { type: "hidden", value: group };
      htmlItems.dtype = { type: "hidden", value: dtype };
    } else {
      if (!dtype) {
        let lastAttr = document.querySelector('.attributes > .attributes-group .attribute:last-child .attribute-dtype')?.value;
        dtype = lastAttr ? lastAttr : "String";
        htmlItems.dtype = { type: "hidden", value: dtype };
      }
    }
    newKey.innerHTML = EntitySheetHelper.getAttributeHtml(htmlItems, nk, group);
    newKey = newKey.children[0];
    form.appendChild(newKey);
    await app._onSubmit(event);
  }

  static async deleteAttribute(event, app) {
    const a = event.currentTarget;
    const li = a.closest(".attribute");
    if ( li ) {
      li.parentElement.removeChild(li);
      await app._onSubmit(event);
    }
  }

  static async createAttributeGroup(event, app) {
    const a = event.currentTarget;
    const form = app.form;
    let newValue = $(a).siblings('.group-prefix').val();
    if ( newValue.length > 0 && EntitySheetHelper.validateGroup(newValue, app.object) ) {
      let newKey = document.createElement("div");
      newKey.innerHTML = `<input type="text" name="system.groups.${newValue}.key" value="${newValue}"/>`;
      newKey = newKey.children[0];
      form.appendChild(newKey);
      await app._onSubmit(event);
    }
  }

  static async deleteAttributeGroup(event, app) {
    const a = event.currentTarget;
    let groupHeader = a.closest(".group-header");
    let groupContainer = groupHeader.closest(".group");
    let group = $(groupHeader).find('.group-key');
    new Dialog({
      title: game.i18n.localize("SIMPLE.DeleteGroup"),
      content: `${game.i18n.localize("SIMPLE.DeleteGroupContent")} <strong>${group.val()}</strong>`,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-trash"></i>',
          label: game.i18n.localize("Yes"),
          callback: async () => {
            groupContainer.parentElement.removeChild(groupContainer);
            await app._onSubmit(event);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("No"),
        }
      }
    }).render(true);
  }

  static updateAttributes(formData, document) {
    let groupKeys = [];
    const formAttrs = foundry.utils.expandObject(formData)?.system?.attributes || {};
    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let attrs = [];
      let group = null;
      if ( !v["key"] ) {
        attrs = Object.keys(v);
        attrs.forEach(attrKey => {
          group = v[attrKey]['group'];
          groupKeys.push(group);
          let attr = v[attrKey];
          const k = this.cleanKey(v[attrKey]["key"] ? v[attrKey]["key"].trim() : attrKey.trim());
          delete attr["key"];
          if ( !obj[group] ) {
            obj[group] = {};
          }
          obj[group][k] = attr;
        });
      } else {
        const k = this.cleanKey(v["key"].trim());
        delete v["key"];
        if ( !group ) {
          obj[k] = v;
        }
      }
      return obj;
    }, {});

    const docAttributes = document.system.attributes || {};
    for ( let k of Object.keys(docAttributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }
    for ( let group of groupKeys) {
      if ( document.system.attributes[group] ) {
        for ( let k of Object.keys(document.system.attributes[group]) ) {
          if ( !attributes[group].hasOwnProperty(k) ) attributes[group][`-=${k}`] = null;
        }
      }
    }
    formData = Object.entries(formData).filter(e => !e[0].startsWith("system.attributes")).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, { _id: document.id, "system.attributes": attributes });
    return formData;
  }

  static updateGroups(formData, document) {
    // Expandir les données soumises
    const formGroups = foundry.utils.expandObject(formData).system?.groups || {};
    // Assurer que document.system.groups est défini
    const docGroups = document.system.groups || {};
    const documentGroups = Object.keys(docGroups);
    
    const groups = Object.entries(formGroups).reduce((obj, [k, v]) => {
      const validGroup = documentGroups.includes(k) || this.validateGroup(k, document);
      if (validGroup) obj[k] = v;
      return obj;
    }, {});
    
    for (let k of Object.keys(docGroups)) {
      if (!groups.hasOwnProperty(k)) groups[`-=${k}`] = null;
    }
    
    formData = Object.entries(formData).filter(e => !e[0].startsWith("system.groups")).reduce((obj, e) => {
      obj[e[0]] = e[1];
      return obj;
    }, { _id: document.id, "system.groups": groups });
    
    return formData;
  }
  

  static async createDialog(data = {}, options = {}) {
    const documentName = this.metadata.name;
    const folders = game.folders.filter(f => (f.type === documentName) && f.displayed);
    const label = game.i18n.localize(this.metadata.label);
    const title = game.i18n.format("DOCUMENT.Create", { type: label });
    const collection = game.collections.get(this.documentName);
    const templates = collection.filter(a => a.getFlag("imperator", "isTemplate"));
    const defaultType = this.TYPES.filter(t => t !== CONST.BASE_DOCUMENT_TYPE)[0] ?? CONST.BASE_DOCUMENT_TYPE;
    const types = { [defaultType]: game.i18n.localize("SIMPLE.NoTemplate") };
    for ( let a of templates ) {
      types[a.id] = a.name;
    }
    const template = "templates/sidebar/document-create.html";
    const html = await renderTemplate(template, {
      name: data.name || game.i18n.format("DOCUMENT.New", { type: label }),
      folder: data.folder,
      folders: folders,
      hasFolders: folders.length > 1,
      type: data.type || templates[0]?.id || "",
      types: types,
      hasTypes: true
    });
    return Dialog.prompt({
      title: title,
      content: html,
      label: title,
      callback: html => {
        const form = html[0].querySelector("form");
        const fd = new FormDataExtended(form);
        let createData = fd.object;
        const template = collection.get(form.type.value);
        if ( template ) {
          createData = foundry.utils.mergeObject(template.toObject(), createData);
          createData.type = template.type;
          delete createData.flags.imperator.isTemplate;
        }
        createData = foundry.utils.mergeObject(createData, data, { inplace: false });
        return this.create(createData, { renderSheet: true });
      },
      rejectClose: false,
      options: options
    });
  }

  static clampResourceValues(attrs) {
    const flat = foundry.utils.flattenObject(attrs);
    for ( const [attr, value] of Object.entries(flat) ) {
      const parts = attr.split(".");
      if ( parts.pop() !== "value" ) continue;
      const current = foundry.utils.getProperty(attrs, parts.join("."));
      if ( current?.dtype !== "Resource" ) continue;
      foundry.utils.setProperty(attrs, attr, Math.clamped(value, current.min || 0, current.max || 0));
    }
  }

  static cleanKey(key) {
    const clean = key.replace(/[\s.]/g, "");
    if ( clean !== key ) ui.notifications.error("SIMPLE.NotifyAttrInvalid", { localize: true });
    return clean;
  }
}
