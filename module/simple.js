/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 */

// Import des modules nécessaires depuis d'autres fichiers du système
import { SimpleActor } from "./actor.js";            // Classe personnalisée pour les acteurs
import { SimpleItem } from "./item.js";              // Classe personnalisée pour les objets (items)
import { SimpleItemSheet } from "./item-sheet.js";   // Fiche personnalisée pour les objets
import { SimpleActorSheet } from "./actor-sheet.js"; // Fiche personnalisée pour les acteurs
import { SimpleNpcSheet } from "./npc-sheet.js";
import { SimpleVehicle } from "./vehicle.js";
import { SimpleVehicleSheet } from "./vehicle-sheet.js";
import { preloadHandlebarsTemplates } from "./templates.js"; // Fonction pour précharger les templates Handlebars
import { createimperatorMacro } from "./macro.js";   // Fonction pour créer des macros spécifiques
import { SimpleToken, SimpleTokenDocument } from "./token.js"; // Classes personnalisées pour les tokens

// Hook qui s'exécute une seule fois lors de l'initialisation du système
Hooks.once("init", async function() {
  // Log indiquant le début de l'initialisation du système Imperator
  console.log(`Initializing Simple imperator System`);

  // Log de la formule d'initiative utilisée
  console.log("Définition de la formule d'initiative : 1d10 + @characteristics.sensus.value");
  // Définition de la formule d'initiative dans la configuration du combat
  CONFIG.Combat.initiative = {
    formula: "1d10 + @characteristics.sensus.value", // La formule inclut 1d10 plus la valeur de Sensus
    decimals: 2                                      // Nombre de décimales à afficher pour le résultat
  };
  // Log de l'objet CONFIG.Combat.initiative pour vérification
  console.log("CONFIG.Combat.initiative :", CONFIG.Combat.initiative);
  
  // Stockage de références spécifiques au système dans l'objet global game.imperator
  game.imperator = {
    SimpleActor,            // Référence à la classe SimpleActor
    createimperatorMacro    // Référence à la fonction de création de macro
  };

  // Définition des classes personnalisées pour les documents des acteurs, objets et tokens



  Actors.unregisterSheet("core", ActorSheet); // Désenregistre la fiche d'acteur par défaut

  console.log("Enregistrement de la fiche pour les PJ (type 'character')...");
  Actors.registerSheet("imperator", SimpleActorSheet, {
    types: ["character"],
    makeDefault: true,
  });
  console.log("Fiche PJ enregistrée.");
  
  console.log("Enregistrement de la fiche pour les PNJ (type 'PNJ')...");
  Actors.registerSheet("imperator", SimpleNpcSheet, {
    types: ["PNJ"],
    makeDefault: true,
  });
  console.log("Fiche PNJ enregistrée.");

  console.log("Enregistrement de la fiche pour les véhicule (type 'véhicule')...");
  Actors.registerSheet("imperator", SimpleVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
  });
  console.log("Fiche Véhicule enregistrée.");
  
  
  


  Items.unregisterSheet("core", ItemSheet); // Désenregistrement de la fiche d'objet par défaut
  Items.registerSheet("imperator", SimpleItemSheet, { makeDefault: true }); // Enregistrement de la fiche d'objet personnalisée comme défaut

  // Enregistrement des paramètres système pour la macro shorthand (raccourci des macros)
  game.settings.register("imperator", "macroShorthand", {
    name: "SETTINGS.SimpleMacroShorthandN",    // Nom localisé du paramètre
    hint: "SETTINGS.SimpleMacroShorthandL",      // Indice localisé pour le paramètre
    scope: "world",                              // Paramètre au niveau du monde
    type: Boolean,                               // Type booléen
    default: true,                               // Valeur par défaut true
    config: true                                 // Affiché dans l'interface de configuration
  });

  // Enregistrement des paramètres système pour la formule d'initiative
  game.settings.register("imperator", "initFormula", {
    name: "SETTINGS.SimpleInitFormulaN",         // Nom localisé du paramètre
    hint: "SETTINGS.SimpleInitFormulaL",           // Indice localisé pour le paramètre
    scope: "world",                                // Paramètre au niveau du monde
    type: String,                                  // Type chaîne de caractères
    default: "1d10 + @characteristics.sensus.value", // Valeur par défaut incluant la valeur de Sensus
    config: true,                                  // Affiché dans l'interface de configuration
    onChange: formula => _simpleUpdateInit(formula, true) // Fonction à appeler lors du changement de la formule
  });

  // Récupération de la formule d'initiative depuis les paramètres du système
  const initFormula = game.settings.get("imperator", "initFormula");
  // Mise à jour de la formule d'initiative avec la fonction définie ci-dessous
  _simpleUpdateInit(initFormula);

  // Fonction locale pour mettre à jour la formule d'initiative
  function _simpleUpdateInit(formula, notify = false) {
    console.log("Mise à jour de la formule d'initiative :", formula); // Log de la formule reçue
    const isValid = Roll.validate(formula); // Validation de la formule via Roll.validate
    console.log("Résultat de Roll.validate :", isValid); // Log du résultat de validation
    if (!isValid) {
      // Si la formule n'est pas valide et notify est true, afficher une notification d'erreur
      if (notify) ui.notifications.error(`${game.i18n.localize("SIMPLE.NotifyInitFormulaInvalid")}: ${formula}`);
      return;
    }
    // Mise à jour de la formule d'initiative dans la configuration du combat
    CONFIG.Combat.initiative.formula = formula;
    console.log("Nouvelle formule d'initiative définie :", CONFIG.Combat.initiative.formula); // Log de la nouvelle formule
  }
  
  // Enregistrement des helpers Handlebars nécessaires pour le rendu des templates

  // Helper 'slugify' pour transformer une chaîne en format slug (format URL-friendly)
  Handlebars.registerHelper('slugify', function(value) {
    return value.slugify({ strict: true });
  });
  // Helper 'range' pour générer une plage de nombres de min à max
  Handlebars.registerHelper('range', function(min, max) {
    let arr = [];
    for (let i = min; i < max; i++) { 
      arr.push(i); // Ajoute chaque nombre dans le tableau
    }
    return arr;
  });

  Handlebars.registerHelper('eq', function(a, b) {
    const numA = Number(a);
    const numB = Number(b);
    // Si les deux valeurs sont des nombres valides, compare-les numériquement
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA === numB;
    }
    // Sinon, fais une comparaison stricte de chaînes
    return a === b;
  });
  
  // Helper 'gte' pour vérifier si une valeur est supérieure ou égale à une autre
  Handlebars.registerHelper('gte', function(a, b) {
    return a >= b;
  });

  // Préchargement des templates Handlebars pour un rendu plus rapide
  await preloadHandlebarsTemplates();
});

// Hook pour gérer le dépôt d'un élément sur la barre de raccourcis (hotbar)
// Crée une macro via la fonction createimperatorMacro lors d'un drop
Hooks.on("hotbarDrop", (bar, data, slot) => createimperatorMacro(data, slot));

// Hook pour ajouter des options contextuelles dans le répertoire des acteurs (Actor Directory)
Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  // Option pour définir un acteur comme template
  options.push({
    name: game.i18n.localize("SIMPLE.DefineTemplate"), // Libellé de l'option (localisé)
    icon: '<i class="fas fa-stamp"></i>',                // Icône associée
    condition: li => {
      const actor = game.actors.get(li.data("documentId")); // Récupère l'acteur correspondant à l'élément
      return !actor.isTemplate;                             // Affiche l'option si l'acteur n'est pas déjà un template
    },
    callback: li => {
      const actor = game.actors.get(li.data("documentId")); // Récupère l'acteur ciblé
      actor.setFlag("imperator", "isTemplate", true);         // Définit le flag "isTemplate" à true pour cet acteur
    }
  });

  // Option pour annuler le statut de template d'un acteur
  options.push({
    name: game.i18n.localize("SIMPLE.UnsetTemplate"),     // Libellé de l'option pour annuler le template
    icon: '<i class="fas fa-times"></i>',                 // Icône associée
    condition: li => {
      const actor = game.actors.get(li.data("documentId")); // Récupère l'acteur ciblé
      return actor.isTemplate;                              // Affiche l'option si l'acteur est déjà un template
    },
    callback: li => {
      const actor = game.actors.get(li.data("documentId")); // Récupère l'acteur ciblé
      actor.setFlag("imperator", "isTemplate", false);        // Retire le flag "isTemplate" (le met à false)
    }
  });
});

// Hook pour ajouter des options contextuelles dans le répertoire des objets (Item Directory)
Hooks.on("getItemDirectoryEntryContext", (html, options) => {
  // Option pour définir un objet comme template
  options.push({
    name: game.i18n.localize("SIMPLE.DefineTemplate"),   // Libellé de l'option (localisé)
    icon: '<i class="fas fa-stamp"></i>',                  // Icône associée
    condition: li => {
      const item = game.items.get(li.data("documentId"));   // Récupère l'objet ciblé
      return !item.isTemplate;                              // Affiche l'option si l'objet n'est pas déjà un template
    },
    callback: li => {
      const item = game.items.get(li.data("documentId"));   // Récupère l'objet ciblé
      item.setFlag("imperator", "isTemplate", true);        // Définit le flag "isTemplate" à true pour cet objet
    }
  });

  // Option pour annuler le statut de template d'un objet
  options.push({
    name: game.i18n.localize("SIMPLE.UnsetTemplate"),      // Libellé de l'option pour annuler le template
    icon: '<i class="fas fa-times"></i>',                  // Icône associée
    condition: li => {
      const item = game.items.get(li.data("documentId"));   // Récupère l'objet ciblé
      return item.isTemplate;                               // Affiche l'option si l'objet est déjà un template
    },
    callback: li => {
      const item = game.items.get(li.data("documentId"));   // Récupère l'objet ciblé
      item.setFlag("imperator", "isTemplate", false);       // Retire le flag "isTemplate" (le met à false)
    }
  });
});
