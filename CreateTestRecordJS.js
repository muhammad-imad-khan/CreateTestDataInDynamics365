function createTestRecord() {
    'use strict';

    function formatLookupBindingKey(entityLogicalName) {
        const parts = entityLogicalName.split("_");
        if (parts.length < 2) return entityLogicalName + "@odata.bind";
        const prefix = parts.slice(0, -1).join("_") + "_";
        const name = parts[parts.length - 1];
        const properName = name.charAt(0).toUpperCase() + name.slice(1);
        return `${prefix}${properName}@odata.bind`;
    }

    try {
        const formContext = Xrm.Page || Xrm.Utility.getGlobalContext();
        const entityLogicalName = Xrm.Page.data.entity.getEntityName();
        let record = {};
        let promises = [];

        Xrm.Page.data.entity.attributes.forEach(function (attribute) {
            const attrName = attribute.getName();
            const attrRequired = attribute.getRequiredLevel();

            if (attrRequired === "required") {
                const attrType = attribute.getAttributeType();

                switch (attrType) {
                    case "string":
                        record[attrName] = "Test_" + Math.random().toString(36).substring(7);
                        break;

                    case "memo":
                        record[attrName] = "Generated test memo.";
                        break;

                    case "datetime":
                        record[attrName] = new Date().toISOString();
                        break;

                    case "boolean":
                        record[attrName] = true;
                        break;

                    case "integer":
                    case "decimal":
                    case "double":
                    case "money":
                        record[attrName] = Math.floor(Math.random() * 1000);
                        break;

                    case "optionset":
                        const options = attribute.getOptions();
                        if (options && options.length > 0) {
                            const randomOption = options[Math.floor(Math.random() * options.length)];
                            record[attrName] = randomOption.value;
                        }
                        break;

                    case "lookup":
                        let lookupEntityTypes = [];

                        const controls = attribute.controls.getAll();
                        if (controls.length > 0 && typeof controls[0].getEntityTypes === "function") {
                            lookupEntityTypes = controls[0].getEntityTypes();
                        }

                        if (
                            attrName === "ownerid" ||
                            lookupEntityTypes.includes("systemuser") ||
                            lookupEntityTypes.includes("owner")
                        ) {
                            console.log("Skipping owner-related/systemuser lookup: " + attrName);
                            break;
                        }

                        if (lookupEntityTypes.length > 0) {
                            const lookupEntity = lookupEntityTypes[0];

                            const lookupPromise = Xrm.WebApi.retrieveMultipleRecords(lookupEntity, "?$top=1").then(function (res) {
                                if (res.entities.length > 0) {
                                    const lookupRecord = res.entities[0];
                                    const lookupIdAttr = Object.keys(lookupRecord).find(k => k.endsWith("id"));
                                    const lookupId = lookupRecord[lookupIdAttr];

                                    const bindingKey = formatLookupBindingKey(attrName);
                                    record[bindingKey] = `/${lookupEntity}s(${lookupId})`;
                                }
                            }).catch(function (err) {
                                console.warn("Lookup fetch failed for: " + attrName, err.message);
                            });

                            promises.push(lookupPromise);
                        }
                        break;

                    default:
                        console.warn("Unhandled type for field: " + attrName);
                        break;
                }
            }
        });

        Xrm.Utility.showProgressIndicator("Creating test record...");

        Promise.all(promises).then(() => {
            Xrm.WebApi.createRecord(entityLogicalName, record).then(
                function success(result) {
                    Xrm.Utility.closeProgressIndicator();

                    const alertStrings = { text: "Test Record created successfully.\nID: " + result.id };
                    const alertOptions = { height: 120, width: 260 };

                    Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                        function () {
                            Xrm.Navigation.openForm({
                                entityName: entityLogicalName,
                                entityId: result.id
                            });
                        }
                    );
                },
                function (error) {
                    Xrm.Utility.closeProgressIndicator();

                    Xrm.Navigation.openAlertDialog({ text: "Failed to create record: " + error.message });
                }
            );
        });


    } catch (error) {
        Xrm.Navigation.openAlertDialog({ text: "Error: " + error.message });
    }
}
