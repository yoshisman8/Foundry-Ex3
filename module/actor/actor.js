import { RollForm } from "../apps/dice-roller.js";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ExaltedThirdActor extends Actor {

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this;
    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
  }

  async displayEmbeddedItem(itemId) {
    // Render the chat card template
    let item = this.items.find(x=> x.id === itemId);
    if(!item){
      return ui.notifications.error(`${this.name} does not have an embedded item id ${itemId}!`);
    }
    const token = this.token;
    const templateData = {
      actor: this,
      tokenId: token?.uuid || null,
      item: item.data
    };
    const html = await renderTemplate("systems/exaltedthird/templates/chat/item-card.html", templateData);

    // Create the ChatMessage data object
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: ChatMessage.getSpeaker({ actor: this, token }),
    };


    // Create the Chat Message or return its data
    return ChatMessage.create(chatData);
  }

  async rollEmbeddedItem(itemId, personal = false) {

    const actorData = duplicate(this);

    let item = this.items.find(x=> x.id == itemId);

    if(!item){
      return ui.notifications.error(`${this.name} does not have an embedded item id ${itemId}!`);
    }

    if(item.type === 'charm') {
      if(item.data.data.cost.motes > 0) {
        if(data.data.motes.peripheral.value > 0 && !personal) {
          data.data.motes.peripheral.value = Math.max(0, data.data.motes.peripheral.value - item.data.data.cost.motes);
        }
        else {
          data.data.motes.personal.value = Math.max(0, data.data.motes.personal.value - item.data.data.cost.motes);
        }
      }
      data.data.willpower.value = Math.max(0, data.data.willpower.value - item.data.data.cost.willpower);
      if(this.type === 'character') {
        data.data.craft.experience.silver.value = Math.max(0, data.data.craft.experience.silver.value - item.data.data.cost.silverxp);
        data.data.craft.experience.gold.value = Math.max(0, data.data.craft.experience.gold.value - item.data.data.cost.goldxp);
        data.data.craft.experience.white.value = Math.max(0, data.data.craft.experience.white.value - item.data.data.cost.whitexp);
      }
      if(data.data.details.aura === item.data.data.cost.aura || item.data.data.cost.aura === 'any') {
        data.data.details.aura = "none";
      }
      if(item.data.data.cost.initiative > 0) {
        let combat = game.combat;
        if (combat) {
            let combatant = combat.data.combatants.find(c => c?.actor?.data?._id == this.id);
            if (combatant) {
                var newInitiative = combatant.initiative - item.data.data.cost.initiative;
                if(combatant.initiative > 0 && newInitiative <= 0) {
                  newInitiative -= 5;
                }
                combat.setInitiative(combatant.id, newInitiative);
            }
        }
      }
      if(item.data.data.cost.anima > 0) {
        var newLevel = data.data.anima.level;
        for(var i = 0; i < item.data.data.cost.anima; i++) {
          if (newLevel === "Transcendent") {
            newLevel = "Bonfire";
          }
          else if (newLevel === "Bonfire") {
            newLevel = "Burning";
          }
          else if (newLevel === "Burning") {
            newLevel = "Glowing";
          }
          if (newLevel === "Glowing") {
            newLevel = "Dim";
          }
        }
        data.data.anima.level = newLevel;
      }
      if(item.data.data.cost.health > 0) {
        let totalHealth = 0;
        for (let [key, health_level] of Object.entries(data.data.health.levels)) {
          totalHealth += health_level.value;
        }
        if(item.data.data.cost.healthtype === 'bashing') {
          data.data.health.bashing = Math.min(totalHealth - data.data.health.aggravated - data.data.health.lethal, data.data.health.bashing + item.data.data.cost.health);
        }
        else if(item.data.data.cost.healthtype === 'lethal') {
          data.data.health.lethal = Math.min(totalHealth - data.data.health.bashing - data.data.health.aggravated, data.data.health.lethal + item.data.data.cost.health);
        }
        else {
          data.data.health.aggravated = Math.min(totalHealth - data.data.health.bashing - data.data.health.lethal, data.data.health.aggravated + item.data.data.cost.health);
        }
      }
    }
    if(item.type === 'spell') {
      data.data.sorcery.motes = 0;
    }

    this.displayEmbeddedItem(itemId);

    this.update(actorData);
  }

  async savedRoll(name){

    const roll = Object.values(this.data.data.savedRolls).find(x=>x. name === name);

    if(!roll){
      return ui.notifications.error(`${this.name} does not have a saved roll named ${name}!`);
    }


    await new RollForm(this, { event: this.event }, {}, { rollId: roll.id, skipDialog: true }).roll();
  }

  getSavedRoll(name){
    const roll = Object.values(this.data.data.savedRolls).find(x=>x. name === name);

    if(!roll){
      return ui.notifications.error(`${this.name} does not have a saved roll named ${name}!`);
    }

    return new RollForm(this, { event: this.event }, {}, { rollId: roll.id });
  }
  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    // Make modifications to data here. For example:

    const data = actorData.data.data;

    // this._prepareBaseActorData(data);
    let totalHealth = 0;
    let currentPenalty = 0;
    let totalWarstriderHealth = 0;
    let totalShipHealth = 0;
    let currentWarstriderPenalty = 0;
    let currentShipPenalty = 0;

    if (data.battlegroup) {
      totalHealth = data.health.levels.zero.value + data.size.value;
      data.health.total = totalHealth;
      if ((data.health.bashing + data.health.lethal + data.health.aggravated) > data.health.total) {
        data.health.aggravated = data.health.total - data.health.lethal;
        if (data.health.aggravated <= 0) {
          data.health.aggravated = 0
          data.health.lethal = data.health.total
        }
      }
      data.health.penalty = 0;
    }
    else {
      for (let [key, health_level] of Object.entries(data.health.levels)) {
        if ((data.health.bashing + data.health.lethal + data.health.aggravated) > totalHealth) {
          currentPenalty = health_level.penalty;
        }
        totalHealth += health_level.value;
      }
      data.health.total = totalHealth;
      if ((data.health.bashing + data.health.lethal + data.health.aggravated) > data.health.total) {
        data.health.aggravated = data.health.total - data.health.lethal;
        if (data.health.aggravated <= 0) {
          data.health.aggravated = 0;
          data.health.lethal = data.health.total;
        }
      }
      data.health.penalty = currentPenalty;
    }


    for (let [key, health_level] of Object.entries(data.warstrider.health.levels)) {
      if ((data.warstrider.health.bashing + data.warstrider.health.lethal + data.warstrider.health.aggravated) > totalWarstriderHealth) {
        currentWarstriderPenalty = health_level.penalty;
      }
      totalWarstriderHealth += health_level.value;
    }
    data.warstrider.health.total = totalWarstriderHealth;
    if ((data.warstrider.health.bashing + data.warstrider.health.lethal + data.warstrider.health.aggravated) > data.warstrider.health.total) {
      data.warstrider.health.aggravated = data.warstrider.health.total - data.warstrider.health.lethal;
      if (data.warstrider.health.aggravated <= 0) {
        data.warstrider.health.aggravated = 0;
        data.warstrider.health.lethal = data.health.total;
      }
    }
    data.warstrider.health.penalty = currentWarstriderPenalty;

    
    for (let [key, health_level] of Object.entries(data.ship.health.levels)) {
      if ((data.ship.health.bashing + data.ship.health.lethal + data.ship.health.aggravated) > totalShipHealth) {
        currentShipPenalty = health_level.penalty;
      }
      totalShipHealth += health_level.value;
    }
    data.ship.health.total = totalShipHealth;
    if ((data.ship.health.bashing + data.ship.health.lethal + data.ship.health.aggravated) > data.ship.health.total) {
      data.ship.health.aggravated = data.ship.health.total - data.ship.health.lethal;
      if (data.ship.health.aggravated <= 0) {
        data.ship.health.aggravated = 0;
        data.ship.health.lethal = data.health.total;
      }
    }
    data.ship.health.penalty = currentShipPenalty;

    if (actorData.type !== "npc") {
      data.experience.standard.spent = data.experience.standard.total - data.experience.standard.value;
      data.experience.exalt.spent = data.experience.exalt.total - data.experience.exalt.value;
    }

    // Initialize containers.
    const gear = [];
    const weapons = [];
    const armor = [];
    const merits = [];
    const intimacies = [];
    const initiations = [];
    const martialarts = [];
    const crafts = [];
    const specialties = [];
    const specialAbilities = [];
    const craftProjects = [];
    const actions = [];


    const charms = {
      strength: { name: 'Ex3.Strength', visible: false, list: [] },
      dexterity: { name: 'Ex3.Dexterity', visible: false, list: [] },
      stamina: { name: 'Ex3.Stamina', visible: false, list: [] },
      charisma: { name: 'Ex3.Charisma', visible: false, list: [] },
      manipulation: { name: 'Ex3.Manipulation', visible: false, list: [] },
      appearance: { name: 'Ex3.Appearance', visible: false, list: [] },
      perception: { name: 'Ex3.Perception', visible: false, list: [] },
      intelligence: { name: 'Ex3.Intelligence', visible: false, list: [] },
      wits: { name: 'Ex3.Wits', visible: false, list: [] },
      archery: { name: 'Ex3.Archery', visible: false, list: [] },
      athletics: { name: 'Ex3.Athletics', visible: false, list: [] },
      awareness: { name: 'Ex3.Awareness', visible: false, list: [] },
      brawl: { name: 'Ex3.Brawl', visible: false, list: [] },
      bureaucracy: { name: 'Ex3.Bureaucracy', visible: false, list: [] },
      craft: { name: 'Ex3.Craft', visible: false, list: [] },
      dodge: { name: 'Ex3.Dodge', visible: false, list: [] },
      integrity: { name: 'Ex3.Integrity', visible: false, list: [] },
      investigation: { name: 'Ex3.Investigation', visible: false, list: [] },
      larceny: { name: 'Ex3.Larceny', visible: false, list: [] },
      linguistics: { name: 'Ex3.Linguistics', visible: false, list: [] },
      lore: { name: 'Ex3.Lore', visible: false, list: [] },
      martialarts: { name: 'Ex3.MartialArts', visible: false, list: [] },
      medicine: { name: 'Ex3.Medicine', visible: false, list: [] },
      melee: { name: 'Ex3.Melee', visible: false, list: [] },
      occult: { name: 'Ex3.Occult', visible: false, list: [] },
      performance: { name: 'Ex3.Performance', visible: false, list: [] },
      presence: { name: 'Ex3.Presence', visible: false, list: [] },
      resistance: { name: 'Ex3.Resistance', visible: false, list: [] },
      ride: { name: 'Ex3.Ride', visible: false, list: [] },
      sail: { name: 'Ex3.Sail', visible: false, list: [] },
      socialize: { name: 'Ex3.Socialize', visible: false, list: [] },
      stealth: { name: 'Ex3.Stealth', visible: false, list: [] },
      survival: { name: 'Ex3.Survival', visible: false, list: [] },
      thrown: { name: 'Ex3.Thrown', visible: false, list: [] },
      war: { name: 'Ex3.War', visible: false, list: [] },
      evocation: { name: 'Ex3.Evocation', visible: false, list: [] },
      other: { name: 'Ex3.Other', visible: false, list: [] },
      universal: { name: 'Ex3.Universal', visible: false, list: [] },
    }

    const spells = {
      terrestrial: { name: 'Ex3.Terrestrial', visible: false, list: [] },
      celestial: { name: 'Ex3.Celestial', visible: false, list: [] },
      solar: { name: 'Ex3.Solar', visible: false, list: [] },
    }

    // Iterate through items, allocating to containers
    for (let i of actorData.items) {
      let item = i.data;

      item.img = i.img || DEFAULT_TOKEN;
      if (i.type === 'item') {
        gear.push(i);
      }
      else if (i.type === 'weapon') {
        weapons.push(i);
      }
      else if (i.type === 'armor') {
        armor.push(i);
      }
      else if (i.type === 'merit') {
        merits.push(i);
      }
      else if (i.type === 'intimacy') {
        intimacies.push(i);
      }
      else if (i.type === 'martialart') {
        martialarts.push(i);
      }
      else if (i.type === 'craft') {
        crafts.push(i);
      }
      else if (i.type === 'initiation') {
        initiations.push(i);
      }
      else if (i.type === 'specialty') {
        specialties.push(i);
      }
      else if (i.type === 'specialability') {
        specialAbilities.push(i);
      }
      else if (i.type === 'craftproject') {
        craftProjects.push(i);
      }
      else if (i.type === 'charm') {
        if (i.data.ability !== undefined) {
          charms[i.data.ability].list.push(i);
          charms[i.data.ability].visible = true;
        }
      }
      else if (i.type === 'spell') {
        if (i.data.circle !== undefined) {
          spells[i.data.circle].list.push(i);
          spells[i.data.circle].visible = true;
        }
      }
      else if (i.type === 'action') {
        actions.push(i);
      }
    }

    // Assign and return
    actorData.gear = gear;
    actorData.weapons = weapons;
    actorData.armor = armor;
    actorData.merits = merits;
    actorData.martialarts = martialarts;
    actorData.crafts = crafts;
    actorData.initiations = initiations;
    actorData.intimacies = intimacies;
    actorData.specialties = specialties;
    actorData.charms = charms;
    actorData.spells = spells;
    actorData.specialabilities = specialAbilities;
    actorData.projects = craftProjects;
    actorData.actions = actions;
  }
}