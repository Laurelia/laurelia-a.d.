Engine.LoadComponentScript("interfaces/Guard.js");
Engine.LoadComponentScript("interfaces/Health.js");
Engine.LoadComponentScript("interfaces/Reform.js");
Engine.LoadComponentScript("interfaces/ResourceGatherer.js");
Engine.LoadComponentScript("interfaces/UnitAI.js");
Engine.LoadComponentScript("Reform.js");
Engine.RegisterGlobal("MT_EntityRenamed", "entityRenamed");

// Test Promote

let cmpReform = ConstructComponent(60, "Reform", {
	"Entity": "infantry_melee_spearman_a",
	"RequiredXP": 1000
});

// Health, Position, Ownership, UnitAI are mandatory in the Reform code
AddMock(60, IID_Health, {
	"GetHitpoints": () => 102,
	"GetMaxHitpoints": () => 102,
});

AddMock(60, IID_Position, {
	"GetPosition2D": () => new Vector2D(1, 0, 0),
	"GetRotation": () => new Vector3D(3, 4, 5),
	"GetHeightOffset": () => {},
	"IsInWorld": () => true,
	"MoveOutOfWorld": () => {}
});

AddMock(60, IID_Ownership, {
	"GetOwner": () => 1,
});

AddMock(60, IID_UnitAI, {
	"GetHeldPosition": () => {},
	"GetStanceName": () => {},
	"GetOrders": () => {},
	"IsGarrisoned": () => {},
	"GetWorkOrders": () => {},
	"IsGuardOf": () => {},
});

Engine.AddEntity = function(name)
{
	if (name != "infantry_melee_spearman_a")
		return undefined;
	AddMock(61, IID_Health, {
		"GetMaxHitpoints": () => 102 * 1.2,
		"SetHitpoints": hp => TS_ASSERT_EQUALS(hp, 102 * 1.2)
	});
	AddMock(61, IID_Position, {
		"JumpTo": () => {},
		"SetYRotation": () => {},
		"SetXZRotation": () => {},
		"SetHeightOffset": () => {},
		"IsInWorld": () => true,
	});
	AddMock(61, IID_Ownership, {
		"SetOwner": id => TS_ASSERT_EQUALS(id, 1),
	});
	AddMock(61, IID_UnitAI, {
		"Cheer": () => {},
		"AddOrders": () => {},
		"SetWorkOrders": () => {},
	});
	return 61;
};

cmpReform.Promote("infantry_melee_spearman_a");
