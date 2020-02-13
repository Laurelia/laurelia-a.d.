function Reform() {}

Reform.prototype.Schema =
	"<element name='Entity'>" +
		"<text/>" +
	"</element>" +
	"<element name='RequiredXp'>" +
		"<data type='positiveInteger'/>" +
	"</element>";

Reform.prototype.Init = function()
{
	this.currentXp = 0;
};

Reform.prototype.GetRequiredXp = function()
{
	return ApplyValueModificationsToEntity("Reform/RequiredXp", +this.template.RequiredXp, this.entity);
};

Reform.prototype.GetCurrentXp = function()
{
	return this.currentXp;
};

Reform.prototype.GetPromotedTemplateName = function()
{
	return this.template.Entity;
};

Reform.prototype.Promote = function(promotedTemplateName)
{
	// If the unit is dead, don't promote it
	var cmpCurrentUnitHealth = Engine.QueryInterface(this.entity, IID_Health);
	if (cmpCurrentUnitHealth.GetHitpoints() == 0)
		return;

	// Create promoted unit entity
	var promotedUnitEntity = Engine.AddEntity(promotedTemplateName);

	// Copy parameters from current entity to promoted one
	var cmpCurrentUnitPosition = Engine.QueryInterface(this.entity, IID_Position);
	var cmpPromotedUnitPosition = Engine.QueryInterface(promotedUnitEntity, IID_Position);
	if (cmpCurrentUnitPosition.IsInWorld())
	{
		var pos = cmpCurrentUnitPosition.GetPosition2D();
		cmpPromotedUnitPosition.JumpTo(pos.x, pos.y);
	}
	var rot = cmpCurrentUnitPosition.GetRotation();
	cmpPromotedUnitPosition.SetYRotation(rot.y);
	cmpPromotedUnitPosition.SetXZRotation(rot.x, rot.z);
	var heightOffset = cmpCurrentUnitPosition.GetHeightOffset();
	cmpPromotedUnitPosition.SetHeightOffset(heightOffset);

	var cmpCurrentUnitOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	var cmpPromotedUnitOwnership = Engine.QueryInterface(promotedUnitEntity, IID_Ownership);
	cmpPromotedUnitOwnership.SetOwner(cmpCurrentUnitOwnership.GetOwner());

	// change promoted unit health to the same percent of hitpoints as unit had before promotion
	var cmpPromotedUnitHealth = Engine.QueryInterface(promotedUnitEntity, IID_Health);
	var healthFraction = Math.max(0, Math.min(1, cmpCurrentUnitHealth.GetHitpoints() / cmpCurrentUnitHealth.GetMaxHitpoints()));
	var promotedUnitHitpoints = cmpPromotedUnitHealth.GetMaxHitpoints() * healthFraction;
	cmpPromotedUnitHealth.SetHitpoints(promotedUnitHitpoints);

	var cmpPromotedUnitReform = Engine.QueryInterface(promotedUnitEntity, IID_Reform);
	if (cmpPromotedUnitReform)
		cmpPromotedUnitReform.IncreaseXp(this.currentXp);

	var cmpCurrentUnitResourceGatherer = Engine.QueryInterface(this.entity, IID_ResourceGatherer);
	var cmpPromotedUnitResourceGatherer = Engine.QueryInterface(promotedUnitEntity, IID_ResourceGatherer);
	if (cmpCurrentUnitResourceGatherer && cmpPromotedUnitResourceGatherer)
	{
		var carriedResorces = cmpCurrentUnitResourceGatherer.GetCarryingStatus();
		cmpPromotedUnitResourceGatherer.GiveResources(carriedResorces);
	}

	var cmpCurrentUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	var cmpPromotedUnitAI = Engine.QueryInterface(promotedUnitEntity, IID_UnitAI);
	var heldPos = cmpCurrentUnitAI.GetHeldPosition();
	if (heldPos)
		cmpPromotedUnitAI.SetHeldPosition(heldPos.x, heldPos.z);
	if (cmpCurrentUnitAI.GetStanceName())
		cmpPromotedUnitAI.SwitchToStance(cmpCurrentUnitAI.GetStanceName());

	var orders = cmpCurrentUnitAI.GetOrders();
	if (cmpCurrentUnitPosition.IsInWorld())	// do not cheer if not visibly garrisoned
		cmpPromotedUnitAI.Cheer();
	if (cmpCurrentUnitAI.IsGarrisoned())
		cmpPromotedUnitAI.SetGarrisoned();
	cmpPromotedUnitAI.AddOrders(orders);

	var workOrders = cmpCurrentUnitAI.GetWorkOrders();
	cmpPromotedUnitAI.SetWorkOrders(workOrders);

	if (cmpCurrentUnitAI.IsGuardOf())
	{
		let guarded = cmpCurrentUnitAI.IsGuardOf();
		let cmpGuard = Engine.QueryInterface(guarded, IID_Guard);
		if (cmpGuard)
		{
			cmpGuard.RenameGuard(this.entity, promotedUnitEntity);
			cmpPromotedUnitAI.SetGuardOf(guarded);
		}
	}

	let cmpCurrentUnitGuard = Engine.QueryInterface(this.entity, IID_Guard);
	let cmpPromotedUnitGuard = Engine.QueryInterface(promotedUnitEntity, IID_Guard);
	if (cmpCurrentUnitGuard && cmpPromotedUnitGuard)
	{
		let entities = cmpCurrentUnitGuard.GetEntities();
		if (entities.length)
		{
			cmpPromotedUnitGuard.SetEntities(entities);
			for (let ent of entities)
			{
				let cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
				if (cmpUnitAI)
					cmpUnitAI.SetGuardOf(promotedUnitEntity);
			}
		}
	}

	Engine.PostMessage(this.entity, MT_EntityRenamed, { "entity": this.entity, "newentity": promotedUnitEntity });

	// Destroy current entity
	if (cmpCurrentUnitPosition && cmpCurrentUnitPosition.IsInWorld())
		cmpCurrentUnitPosition.MoveOutOfWorld();
	Engine.DestroyEntity(this.entity);
	// save the entity id
	this.promotedUnitEntity = promotedUnitEntity;
};

Reform.prototype.IncreaseXp = function(amount)
{
	// if the unit was already promoted, but is waiting for the engine to be destroyed
	// transfer the gained xp to the promoted unit if applicable
	if (this.promotedUnitEntity)
	{
		var cmpReform = Engine.QueryInterface(this.promotedUnitEntity, IID_Reform);
		if (cmpReform)
			cmpReform.IncreaseXp(amount);
		return;
	}

	this.currentXp += +(amount);
	var requiredXp = this.GetRequiredXp();

	if (this.currentXp >= requiredXp)
	{
		var cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);
		var playerID = QueryOwnerInterface(this.entity, IID_Player).GetPlayerID();
		this.currentXp -= requiredXp;
		var promotedTemplateName = this.GetPromotedTemplateName();
		// check if we can upgrade a second time (or even more)
		while (true)
		{
			var template = cmpTemplateManager.GetTemplate(promotedTemplateName);
			if (!template.Reform)
				break;
			requiredXp = ApplyValueModificationsToTemplate("Reform/RequiredXp", +template.Reform.RequiredXp, playerID, template);
			// compare the current xp to the required xp of the promoted entity
			if (this.currentXp < requiredXp)
				break;
			this.currentXp -= requiredXp;
			promotedTemplateName = template.Reform.Entity;
		}
		this.Promote(promotedTemplateName);
	}
};

Reform.prototype.OnValueModification = function(msg)
{
	if (msg.component == "Reform")
		this.IncreaseXp(0);
};

Engine.RegisterComponentType(IID_Reform, "Reform", Reform);
