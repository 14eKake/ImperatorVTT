// systems/imperator/scripts/vehicle.js
import { EntitySheetHelper } from "./helper.js";

export class SimpleVehicle extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    // Assurer l'existence de system.health
    this.system.health = this.system.health || { value: 20, min: 0, max: 20 };
    this.system.attributes = this.system.attributes || {};
    // Calculer les Points de Structure (PS) : 1 PS = 10 PV
    // Ici, on suppose que l'utilisateur saisit directement les PS dans system.health
    // Sinon, tu pourrais convertir : par exemple, PS = Math.floor(PV / 10)
    // Pour cet exemple, nous laisserons les PS directement dans system.health

    // Pour l'artillerie, on peut ajouter des propriétés supplémentaires
    if (this.system.type === "artillerie") {
      this.system.servants = this.system.servants || 0;       // Nombre de servants requis
      this.system.reloadRounds = this.system.reloadRounds || 2; // Rounds de rechargement par défaut
    }
    // Tu peux ajouter d'autres calculs spécifiques aux véhicules ici
  }

  static async createDialog(data = {}, options = {}) {
    return EntitySheetHelper.createDialog.call(this, data, options);
  }

  get isTemplate() {
    return !!this.getFlag("imperator", "isTemplate");
  }
}
