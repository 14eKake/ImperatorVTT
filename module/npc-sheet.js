// systems/imperator/scripts/npc-sheet.js

export class SimpleNpcSheet extends ActorSheet {
    /** Définit les options par défaut pour la fiche PNJ */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["imperator", "sheet", "npc"],
        template: "systems/imperator/templates/npc-sheet.html",
        width: 400,
        height: 300
      });
    }
    
    /** Prépare les données à transmettre au template PNJ */
    async getData(options) {
      const context = await super.getData(options);
      // V13 compatible: Use context.system instead of deprecated context.data.system
      // In V13, super.getData() returns context.system directly
      context.systemData = context.system || context.actor?.system;
      return context;
    }
    
    /** Active les écouteurs (optionnel pour le moment, on peut laisser vide) */
    activateListeners(html) {
      super.activateListeners(html);
      // Pas d'interactions particulières pour le PNJ pour le moment
    }
  }
  