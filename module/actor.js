// Importation du helper permettant de manipuler les fiches (sheets)
import { EntitySheetHelper } from "./helper.js";

/**
 * Extension du document de base Actor pour prendre en charge les attributs et groupes,
 * avec une boîte de dialogue personnalisée pour la création de template.
 * @extends {Actor}
 */
export class SimpleActor extends Actor {

  /** 
   * Méthode permettant de calculer des données dérivées pour l'acteur.
   * @inheritdoc 
   */
  prepareDerivedData() {
    // Appel de la méthode de la classe parente
    super.prepareDerivedData();
    // S'assurer que les objets 'groups' et 'attributes' existent dans le système de l'acteur
    this.system.groups = this.system.groups || {};
    this.system.attributes = this.system.attributes || {};


    // Calcul dérivé des points de vie :
    // Selon les règles, chaque personnage a 5 PV de base plus 2 PV par point en Corpus.
    const corpus = this.system.characteristics.corpus.value || 1; // Récupère la valeur de "corpus", ou 1 par défaut
    this.system.health.max = 5 + (2 * corpus); // Calcule le maximum de points de vie

    // Si la valeur actuelle de santé dépasse le maximum calculé, on la ramène à ce maximum.
    if (this.system.health.value > this.system.health.max) {
      this.system.health.value = this.system.health.max;
    }

    // Ici, vous pouvez ajouter d'autres calculs dérivés (par exemple basés sur les avantages/défauts, etc.)

    // Appelle une méthode du helper pour s'assurer que les valeurs de type "Resource" sont bien comprises
    EntitySheetHelper.clampResourceValues(this.system.attributes);
  }

  /** 
   * Méthode statique pour créer une boîte de dialogue de création de template.
   * @override 
   */
  static async createDialog(data = {}, options = {}) {
    // Appelle la méthode createDialog du helper en utilisant le contexte de cette classe
    return EntitySheetHelper.createDialog.call(this, data, options);
  }

  /**
   * Propriété indiquant si cet acteur est utilisé comme template pour d'autres acteurs.
   * @type {boolean}
   */
  get isTemplate() {
    // Retourne true si le flag "isTemplate" est défini pour ce système
    return !!this.getFlag("imperator", "isTemplate");
  }

  /** 
   * Prépare et retourne les données pour le jet de dés (roll).
   * @inheritdoc 
   */
  getRollData() {
    // Convertit l'acteur en objet et récupère la partie système
    const data = this.toObject(false).system;
    // Log pour vérifier les données de roll de l'acteur
    console.log("Roll data pour l'acteur", this.name, ":", data);
    // Récupère le réglage pour le mode shorthand des macros
    const shorthand = game.settings.get("imperator", "macroShorthand");
    // Tableaux qui stockeront les clés des attributs qui sont des formules et celles sur les items
    const formulaAttributes = [];
    const itemAttributes = [];
    // Applique un traitement pour mettre en place le mode shorthand pour les attributs de l'acteur
    this._applyShorthand(data, formulaAttributes, shorthand);
    // Traite les attributs provenant des items possédés par l'acteur
    this._applyItems(data, itemAttributes, shorthand);
    // Remplace les références de formules dans les attributs des items
    this._applyItemsFormulaReplacements(data, itemAttributes, shorthand);
    // Remplace les références de formules dans les attributs de l'acteur
    this._applyFormulaReplacements(data, formulaAttributes, shorthand);
    // Si le mode shorthand est activé, on supprime les objets complexes d'attributs, groupes, etc.
    if (shorthand) {
      delete data.attributes;
      delete data.attr;
      delete data.groups;
    }
    // Retourne l'objet de données prêt à être utilisé pour les jets
    return data;
  }

  /**
   * Applique le mode shorthand sur les attributs de l'acteur.
   * Remplit le tableau formulaAttributes pour les attributs de type "Formula".
   * @param {Object} data - Les données système de l'acteur.
   * @param {Array} formulaAttributes - Tableau pour stocker les clés d'attributs formule.
   * @param {boolean} shorthand - Indique si le mode shorthand est activé.
   */
  _applyShorthand(data, formulaAttributes, shorthand) {
    // Parcourt chaque attribut présent dans data.attributes
    for ( let [k, v] of Object.entries(data.attributes || {}) ) {
      // Si l'attribut est une formule, on ajoute sa clé au tableau
      if (v.dtype === "Formula") formulaAttributes.push(k);
      // Si le mode shorthand est activé
      if (shorthand) {
        // S'il n'existe pas déjà une propriété à la racine de data avec la clé k
        if (!(k in data)) {
          // Si l'attribut a un type défini, on copie sa valeur directement
          if (v.dtype) {
            data[k] = v.value;
          } else {
            // Sinon, il s'agit probablement d'un groupe d'attributs
            data[k] = {};
            // On parcourt chaque sous-attribut dans le groupe
            for (let [gk, gv] of Object.entries(v)) {
              data[k][gk] = gv.value;
              // Si le sous-attribut est une formule, on enregistre la clé complète (groupe.sous-clé)
              if (gv.dtype === "Formula") formulaAttributes.push(`${k}.${gk}`);
            }
          }
        }
      }
    }
  }

  /**
   * Applique le traitement des attributs provenant des items possédés par l'acteur.
   * Remplit le tableau itemAttributes pour les attributs de type "Formula" des items.
   * @param {Object} data - Les données système de l'acteur.
   * @param {Array} itemAttributes - Tableau pour stocker les clés d'attributs formule des items.
   * @param {boolean} shorthand - Indique si le mode shorthand est activé.
   */
  _applyItems(data, itemAttributes, shorthand) {
    // Réduit le tableau des items de l'acteur en un objet indexé par une clé dérivée du nom (slug)
    data.items = this.items.reduce((obj, item) => {
      // Génère une clé pour l'item à partir de son nom
      const key = item.name.slugify({ strict: true });
      // Récupère les données système de l'item
      const itemData = item.toObject(false).system;
      // Parcourt les attributs de l'item
      for (let [k, v] of Object.entries(itemData.attributes)) {
        // Si l'attribut est de type "Formula", enregistre sa clé sous une forme particulière (avec "..")
        if (v.dtype === "Formula") itemAttributes.push(`${key}..${k}`);
        // Si le mode shorthand est activé
        if (shorthand) {
          // Si la clé n'existe pas déjà dans itemData
          if (!(k in itemData)) {
            if (v.dtype) {
              // On copie directement la valeur de l'attribut
              itemData[k] = v.value;
            } else {
              // Sinon, il s'agit d'un groupe d'attributs
              if (!itemData[k]) itemData[k] = {};
              // Parcourt chaque sous-attribut dans le groupe
              for (let [gk, gv] of Object.entries(v)) {
                itemData[k][gk] = gv.value;
                // Si le sous-attribut est une formule, enregistre la clé complète avec le préfixe du nom de l'item
                if (gv.dtype === "Formula") itemAttributes.push(`${key}..${k}.${gk}`);
              }
            }
          }
        } else {
          // En mode non-shorthand, on traite uniquement les attributs qui ne sont pas de type (dtype) défini
          if (!v.dtype) {
            if (!itemData[k]) itemData[k] = {};
            for (let [gk, gv] of Object.entries(v)) {
              itemData[k][gk] = gv.value;
              if (gv.dtype === "Formula") itemAttributes.push(`${key}..${k}.${gk}`);
            }
          }
        }
      }
      // Si le mode shorthand est activé, on supprime la structure originale d'attributs de l'item
      if (shorthand) {
        delete itemData.attributes;
      }
      // On assigne les données traitées de l'item à l'objet global data.items en utilisant la clé générée
      obj[key] = itemData;
      return obj;
    }, {});
  }

  /**
   * Applique les remplacements de formules pour les attributs issus des items.
   * Permet de remplacer les références du type "@item." par la syntaxe attendue dans le contexte global.
   * @param {Object} data - Les données système de l'acteur.
   * @param {Array} itemAttributes - Tableau contenant les clés des attributs formule des items.
   * @param {boolean} shorthand - Indique si le mode shorthand est activé.
   */
  _applyItemsFormulaReplacements(data, itemAttributes, shorthand) {
    // Parcourt chaque clé enregistrée dans itemAttributes
    for ( let k of itemAttributes ) {
      let item = null;
      // La clé est séparée en deux parties avec ".." : la première partie correspond au nom de l'item
      let itemKey = k.split('..');
      item = itemKey[0];
      // La deuxième partie correspond à la clé de l'attribut, possiblement avec un sous-attribut
      k = itemKey[1];
      let gk = null;
      // Si la clé contient un point, cela signifie qu'il y a un sous-attribut
      if ( k.includes('.') ) {
        let attrKey = k.split('.');
        k = attrKey[0];
        gk = attrKey[1];
      }
      let formula = '';
      if ( shorthand ) {
        // En mode shorthand, on remplace directement dans data.items en vérifiant si le sous-attribut existe
        if ( data.items[item][k][gk] ) {
          formula = data.items[item][k][gk].replace('@item.', `@items.${item}.`);
          data.items[item][k][gk] = Roll.replaceFormulaData(formula, data);
        } else if ( data.items[item][k] ) {
          formula = data.items[item][k].replace('@item.', `@items.${item}.`);
          data.items[item][k] = Roll.replaceFormulaData(formula, data);
        }
      } else {
        // En mode non-shorthand, la structure des attributs est plus imbriquée
        if ( data.items[item]['attributes'][k][gk] ) {
          formula = data.items[item]['attributes'][k][gk]['value'].replace('@item.', `@items.${item}.attributes.`);
          data.items[item]['attributes'][k][gk]['value'] = Roll.replaceFormulaData(formula, data);
        } else if ( data.items[item]['attributes'][k]['value'] ) {
          formula = data.items[item]['attributes'][k]['value'].replace('@item.', `@items.${item}.attributes.`);
          data.items[item]['attributes'][k]['value'] = Roll.replaceFormulaData(formula, data);
        }
      }
    }
  }

  /**
   * Applique les remplacements de formules pour les attributs de l'acteur.
   * Remplace les formules contenues dans les attributs par leur version évaluée.
   * @param {Object} data - Les données système de l'acteur.
   * @param {Array} formulaAttributes - Tableau contenant les clés des attributs formule.
   * @param {boolean} shorthand - Indique si le mode shorthand est activé.
   */
  _applyFormulaReplacements(data, formulaAttributes, shorthand) {
    // Parcourt chaque clé d'attribut enregistrée dans formulaAttributes
    for ( let k of formulaAttributes ) {
      let attr = null;
      // Si la clé contient un point, cela signifie qu'elle se réfère à un attribut dans un groupe
      if ( k.includes('.') ) {
        let attrKey = k.split('.');
        k = attrKey[0];
        attr = attrKey[1];
      }
      // Si l'attribut possède une propriété 'value', on remplace la formule par la valeur évaluée
      if ( data.attributes[k]?.value ) {
        data.attributes[k].value = Roll.replaceFormulaData(String(data.attributes[k].value), data);
      } else if ( attr ) {
        // Sinon, si on est dans le cas d'un attribut groupé, on remplace la valeur correspondante
        data.attributes[k][attr].value = Roll.replaceFormulaData(String(data.attributes[k][attr].value), data);
      }
      // Si le mode shorthand est activé, on simplifie la structure en déplaçant la valeur évaluée directement à la racine
      if ( shorthand ) {
        if ( data.attributes[k]?.value ) {
          data[k] = data.attributes[k].value;
        } else {
          if ( attr ) {
            if (!data[k]) {
              data[k] = {};
            }
            data[k][attr] = data.attributes[k][attr].value;
          }
        }
      }
    }
  }
}
