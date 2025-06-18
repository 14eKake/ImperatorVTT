// Importation des modules nécessaires depuis d'autres fichiers du système
import { EntitySheetHelper } from "./helper.js";
import { ATTRIBUTE_TYPES } from "./constants.js";

// Définition d'un tableau de seuils de réussite pour les jets de compétences
// Chaque sous-tableau correspond à un niveau de compétence (0 à 5) et fournit les seuils pour les difficultés de 0 à 5.
const successThresholds = [
  [5, 6, 7, 8, 9, 10], // skill=0 (Ignare)
  [4, 5, 6, 7, 8, 9],  // skill=1 (Novice)
  [3, 4, 5, 6, 7, 8],  // skill=2 (Disciple)
  [3, 4, 5, 6, 7, 8],  // skill=3 (Maître)
  [2, 3, 4, 5, 6, 7],  // skill=4 (Héros)
  [2, 2, 3, 4, 5, 6],  // skill=5 (Légendaire)
];

/**
 * Extension de la feuille d'acteur pour IMPERATOR.
 * Cette classe personnalise l'interface et le comportement de la fiche d'acteur dans le système.
 * @extends {ActorSheet}
 */
export class SimpleActorSheet extends ActorSheet {

  /** 
   * Définit les options par défaut de la fiche d'acteur.
   * Fusionne les options par défaut de la classe parente avec celles spécifiques au système.
   * @inheritdoc 
   */
  static get defaultOptions() {
    console.log("Définition des options par défaut de SimpleActorSheet");
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["imperator", "sheet", "actor"],
      template: "systems/imperator/templates/actor-sheet.html",
      width: 1000,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /**
   * Prépare les données à transmettre au template pour le rendu de la fiche d'acteur.
   * On enrichit certaines parties (biographie, compétences regroupées, etc.) et on prépare les types d'attributs.
   * @inheritdoc
   */
  async getData(options) {
    console.log("Appel de getData dans SimpleActorSheet");
    const context = await super.getData(options);
    console.log("Contexte de base récupéré :", context);
    context.shorthand = !!game.settings.get("imperator", "macroShorthand");
    context.systemData = context.data.system;
    context.dtypes = ATTRIBUTE_TYPES;
    context.biographyHTML = await TextEditor.enrichHTML(context.systemData.biography, {
      secrets: this.document.isOwner,
      async: true
    });
    const skills = duplicate(this.actor.system.skills || {});
    context.systemData.skillsByAttribute = {
      corpus: [],
      charisma: [],
      sensus: [],
      spiritus: []
    };
    for (let [skillName, skillData] of Object.entries(skills)) {
      let attr = skillData.attribute || "corpus";
      if (context.systemData.skillsByAttribute[attr]) {
        context.systemData.skillsByAttribute[attr].push({
          name: skillName,
          level: skillData.level,
          attribute: attr
        });
      }
    }
    console.log("Contexte final envoyé au template :", context);
    return context;
  }

  /**
   * Active les écouteurs d'événements sur la fiche d'acteur après son rendu.
   * @inheritdoc
   */
  activateListeners(html) {
    console.log("Activation des écouteurs sur SimpleActorSheet");
    super.activateListeners(html);
    if (!this.isEditable) return;
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".add-skill").click(this._onAddSkill.bind(this));
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        console.log("Début du drag, données :", dragData);
        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      }, false);
    });
    html.find(".skill-name").click(this._onSkillRoll.bind(this));
    console.log("Écouteurs activés.");
  }

  /**
   * Gère le clic sur les boutons de contrôle des items (création, édition, suppression).
   * @param {MouseEvent} event 
   * @private
   */
  _onItemControl(event) {
    console.log("Clic sur le contrôle d'un item");
    event.preventDefault();
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    console.log("Action sur l'item :", item, "Action :", button.dataset.action);
    switch (button.dataset.action) {
      case "create":
        const cls = getDocumentClass("Item");
        return cls.create({ name: game.i18n.localize("SIMPLE.ItemNew"), type: "item" }, { parent: this.actor });
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }

  /**
   * Gère le clic sur un bouton de jet d'item pour lancer un jet de dés.
   * @param {MouseEvent} event 
   */
  _onItemRoll(event) {
    console.log("Clic sur le jet d'un item");
    let button = $(event.currentTarget);
    const li = button.parents(".item");
    const item = this.actor.items.get(li.data("itemId"));
    console.log("Jet d'item :", item);
    let r = new Roll(button.data("roll"), this.actor.getRollData());
    console.log("Formule de roll :", button.data("roll"), "Données :", this.actor.getRollData());
    return r.toMessage({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h2>${item.name}</h2><h3>${button.text()}</h3>`
    });
  }

  /**
   * Gère le clic sur le nom d'une compétence pour lancer un jet de dés.
   * Le nombre total de dés lancés est la somme du niveau de la compétence, du niveau de la caractéristique associée,
   * et d'un modificateur saisi par l'utilisateur. La difficulté est choisie via un menu déroulant.
   * Chaque dé dont le résultat est supérieur ou égal au seuil compte comme succès,
   * un 10 rapporte 2 succès et un 1 retire 1 succès.
   * Après le jet, si la compétence fait partie des compétences réactives, un message de réaction est généré.
   * @param {MouseEvent} event 
   */
  async _onSkillRoll(event) {
    console.log("Début du jet de compétence");
    event.preventDefault();
    const targetElement = event.currentTarget;
    console.log("Nombre de cibles sélectionnées :", event.currentTarget.length);

    const skillName = targetElement.textContent.trim();
    console.log("Compétence lancée :", skillName);
    const skillEntry = targetElement.closest(".skill-entry");
    if (!skillEntry) return;
    const selectElem = skillEntry.querySelector("select");
    if (!selectElem) return;
    const skillLevel = parseInt(selectElem.value) || 0;
    const hiddenAttrInput = skillEntry.querySelector('input[type="hidden"][name$=".attribute"]');
    if (!hiddenAttrInput) return;
    const attributeName = hiddenAttrInput.value;
    const charData = this.actor.system.characteristics[attributeName];
    const characteristicLevel = charData ? parseInt(charData.value) || 0 : 0;
    console.log("Niveau compétence :", skillLevel, "Caractéristique :", characteristicLevel);

    new Dialog({
      title: `Jet de ${skillName}`,
      content: `
        <div style="display: flex; flex-direction: column; gap: 0.5em;">
          <div>
            <label for="difficulty">Difficulté :</label>
            <select id="difficulty" name="difficulty">
              <option value="0">Très Facile</option>
              <option value="1">Facile</option>
              <option value="2" selected>Normale</option>
              <option value="3">Difficile</option>
              <option value="4">Très Difficile</option>
              <option value="5">Héroïque</option>
            </select>
          </div>
          <div>
            <label for="diceMod">Modificateur de dés (+/-) :</label>
            <input type="number" id="diceMod" name="diceMod" value="0" />
          </div>
        </div>
      `,
      buttons: {
        ok: {
          label: "Lancer",
          callback: async (html) => {
            const difficulty = parseInt(html.find("#difficulty").val()) || 0;
            const diceMod = parseInt(html.find("#diceMod").val()) || 0;
            console.log("Difficulté saisie :", difficulty, "Modificateur :", diceMod);
            const totalDice = (skillLevel + characteristicLevel) + diceMod;
            if (totalDice <= 0) {
              ui.notifications.warn("Aucun dé à lancer (<= 0).");
              return;
            }
            const sLevel = Math.clamped(skillLevel, 0, 5);
            const diff = Math.clamped(difficulty, 0, 5);
            const threshold = successThresholds[sLevel][diff];
            const formula = `${totalDice}d10`;
            console.log("Formule de jet :", formula, "Seuil :", threshold);
            const rollData = this.actor.getRollData();
            const roll = new Roll(formula, rollData);
            await roll.evaluate({ async: true });
            const diceResults = roll.terms[0]?.results || [];
            console.log("Résultats des dés :", diceResults);
            const successes = diceResults.reduce((acc, d) => {
              if (d.result === 10) return acc + 2;
              if (d.result === 1) return acc - 1;
              if (d.result >= threshold) return acc + 1;
              return acc;
            }, 0);
            console.log("Succès obtenus :", successes);
            roll.toMessage({
              user: game.user.id,
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: `
                <h2>${skillName}</h2>
                <p><strong>Difficulté :</strong> ${difficulty} (Seuil : ${threshold})</p>
                <p><strong>Niveau compétence :</strong> ${skillLevel}, <strong>Caractéristique :</strong> ${characteristicLevel}, <strong>Mod. :</strong> ${diceMod}</p>
                <p><strong>Jet :</strong> ${formula} - <strong>Succès :</strong> ${successes}</p>
              `
            });
            
            // Si la compétence est réactive, générer un message de réaction pour la défense
            const reactiveSkills = ["acontondantes", "aperforantes", "atranchantes", "ajetarc", "ajetfronde", "ajet"];
            if (reactiveSkills.includes(skillName.toLowerCase())) {
              console.log("Compétence réactive détectée :", skillName);
              // Récupère la cible sélectionnée par l'utilisateur via game.user.targets
              const targets = Array.from(game.user.targets);
              if (targets.length > 0) {
                const targetToken = targets[0];
                const targetActor = targetToken.actor;
                console.log("Cible de l'attaque :", targetActor?.name);
                if (targetActor) {
                  ChatMessage.create({
                    speaker: { alias: "Système d'attaque" },
                    content: `
                      <div>
                        <p>${targetActor.name}, vous êtes attaqué par ${this.actor.name} avec ${skillName} !</p>
                        <p>Voulez-vous parer ou esquiver ?</p>
                        <button class="reaction" data-action="parer" data-target="${targetActor.id}">Parer</button>
                        <button class="reaction" data-action="esquiver" data-target="${targetActor.id}">Esquiver</button>
                      </div>
                    `,
                    flags: { attackReaction: true }
                  });
                  console.log("Message de réaction créé pour", targetActor.name);
                }
              } else {
                console.log("Aucune cible sélectionnée pour l'attaque réactive.");
              }
            }
          }
        },
        cancel: { label: "Annuler" }
      },
      default: "ok"
    }).render(true);
  }

  /**
   * Prépare les données du formulaire avant soumission, en mettant à jour les attributs et groupes via le helper.
   * @inheritdoc
   */
  _getSubmitData(updateData) {
    console.log("Début de _getSubmitData");
    let formData = super._getSubmitData(updateData);
    console.log("FormData avant updateAttributes :", formData);
    formData = EntitySheetHelper.updateAttributes(formData, this.object);
    formData = EntitySheetHelper.updateGroups(formData, this.object);
    console.log("FormData final :", formData);
    return formData;
  }

  /**
   * Ouvre une boîte de dialogue pour ajouter une nouvelle compétence.
   * La nouvelle compétence est ajoutée dans system.skills avec un niveau par défaut de 0 et l'attribut "corpus".
   * @param {MouseEvent} event 
   */
  async _onAddSkill(event) {
    console.log("Ouverture de la boîte de dialogue pour ajouter une compétence");
    event.preventDefault();
    let d = new Dialog({
      title: "Ajouter une compétence",
      content: `<p>Nom de la compétence :</p><input type="text" id="new-skill-name" style="width:100%"/>`,
      buttons: {
        ok: {
          label: "Ajouter",
          callback: async (html) => {
            let newSkill = html.find("#new-skill-name").val().trim();
            console.log("Nouvelle compétence saisie :", newSkill);
            if (newSkill.length === 0) {
              ui.notifications.error("Le nom de la compétence ne peut être vide.");
              return;
            }
            let skills = duplicate(this.actor.system.skills || {});
            if (skills[newSkill]) {
              ui.notifications.error("Cette compétence existe déjà.");
              return;
            }
            skills[newSkill] = { level: 0, attribute: "corpus" };
            await this.actor.update({ "system.skills": skills });
            this.render(false);
            ui.notifications.info(`Compétence "${newSkill}" ajoutée.`);
            console.log("Nouvelle compétence ajoutée :", newSkill);
          }
        },
        cancel: { label: "Annuler" }
      },
      default: "ok"
    });
    d.render(true);
  }

  /**
   * Réactive les écouteurs d'événements pour la fiche d'acteur.
   * @inheritdoc
   */
  activateListeners(html) {
    console.log("Réactivation des écouteurs dans activateListeners");
    super.activateListeners(html);
    if (!this.isEditable) return;
    html.find(".item-control").click(this._onItemControl.bind(this));
    html.find(".items .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".add-skill").click(this._onAddSkill.bind(this));
    html.find(".attributes a.attribute-roll").each((i, a) => {
      a.setAttribute("draggable", true);
      a.addEventListener("dragstart", ev => {
        let dragData = ev.currentTarget.dataset;
        console.log("Début du drag dans activateListeners, données :", dragData);
        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      }, false);
    });
    html.find(".skill-name").click(this._onSkillRoll.bind(this));
    console.log("Tous les écouteurs ont été réactivés.");
  }
}

// Hook pour attacher des écouteurs aux boutons de réaction dans les messages de chat
Hooks.on("renderChatMessage", (html, message) => {
  console.log("Rendu d'un message de chat avec flags :", message.flags);
  // Vérifier que message.flags existe et que attackReaction est défini
  if (message.flags?.attackReaction) {
    console.log("Message de chat détecté avec attackReaction flag");
    html.find("button.reaction").click(ev => {
      const action = ev.currentTarget.dataset.action;
      const targetId = ev.currentTarget.dataset.target;
      console.log("Bouton de réaction cliqué. Action :", action, "Cible ID :", targetId);
      const targetActor = game.actors.get(targetId);
      if (!targetActor) {
        console.log("Aucun acteur trouvé pour l'ID :", targetId);
        return;
      }
      let defenseFormula = "";
      if (action === "parer") {
        defenseFormula = "1d10 + @attributes.bouclier"; // Utiliser la propriété correspondante pour la parade
      } else if (action === "esquiver") {
        defenseFormula = "1d10 + @attributes.esquive";   // Utiliser la propriété correspondante pour l'esquive
      }
      console.log("Formule de défense utilisée :", defenseFormula);
      const roll = new Roll(defenseFormula, targetActor.getRollData());
      roll.evaluate({ async: true }).then(() => {
        console.log("Résultat du jet de défense :", roll.total);
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: targetActor }),
          flavor: `${action === "parer" ? "Parade" : "Esquive"} de ${targetActor.name}`
        });
      });
    });
  }
});
