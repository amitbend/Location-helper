"use strict";
var consts_1 = require("../consts");
var common = require("../common");
var botbuilder_1 = require("botbuilder");
var locationService = require("../services/bing-geospatial-service");
function register(library, apiKey) {
    library.dialog('retrieve-facebook-location-dialog', createDialog(apiKey));
    library.dialog('facebook-location-resolve-dialog', createLocationResolveDialog());
}
exports.register = register;
function createDialog(apiKey) {
    return [
        function (session, args,options) {
            session.dialogData.options = args;
            session.beginDialog('facebook-location-resolve-dialog', session.dialogData.options);
        },
        function (session, results, next) {
            if (session.dialogData.options.reverseGeocode && results.response && results.response.place) {
                locationService.getLocationByPoint(apiKey, results.response.place.point.coordinates[0], results.response.place.point.coordinates[1])
                    .then(function (locations) {
                    var place;
                    if (locations.length && locations[0].address) {
                        var address = {
                            addressLine: undefined,
                            formattedAddress: undefined,
                            adminDistrict: locations[0].address.adminDistrict,
                            adminDistrict2: locations[0].address.adminDistrict2,
                            countryRegion: locations[0].address.countryRegion,
                            locality: locations[0].address.locality,
                            postalCode: locations[0].address.postalCode
                        };
                        place = { address: address, bbox: locations[0].bbox, confidence: locations[0].confidence, entityType: locations[0].entityType, name: locations[0].name, point: locations[0].point };
                    }
                    else {
                        place = results.response.place;
                    }
                    session.endDialogWithResult({ response: { place: place } });
                })
                    .catch(function (error) { return session.error(error); });
                ;
            }
            else {
                next(results);
            }
        }
    ];
}
function createLocationResolveDialog() {
    return common.createBaseDialog()
        .onBegin(function (session, args) {

        session.dialogData.options = args;
        sendLocationPrompt(session, session.dialogData.options.prompt ,args.constantLocation,args.entireCity).sendBatch();
    }).onDefault(function (session,args) {
        var entities = session.message.entities;
        for (var i = 0; i < entities.length; i++) {
            if (entities[i].type == "Place" && entities[i].geo && entities[i].geo.latitude && entities[i].geo.longitude) {
                session.endDialogWithResult({ response: { place: buildLocationFromGeo(Number(entities[i].geo.latitude), Number(entities[i].geo.longitude)) } });
                return;
            }
        }
        try{

            // incase of my kind of quick reply
            var location = JSON.parse(session.message.text)
            if (location.longitude && location.latitude){
                session.endDialogWithResult({ response: { place: buildLocationFromGeo(Number(location.latitude), Number(location.longitude)) } })
                return;
            }
            if (location.city){
                session.endDialogWithResult({ response: { place : {city : true , latitude : 0, longitude : 0}  } })
                return;
            }
            
        }
        catch(e){

        }
        var prompt = session.gettext(consts_1.Strings.InvalidLocationResponseFacebook);
        sendLocationPrompt(session, prompt,session.dialogData.options.constantLocation,session.dialogData.options.entireCity).sendBatch();
    });
}
function sendLocationPrompt(session, prompt,constantLocation,entireCity) {
    // a really bad implemenation just to make it work :|
    var message = new botbuilder_1.Message(session).text(prompt || '');
    let quickArr = []
    if (constantLocation){
        quickArr.push({
            "content_type":"text",
            "title":constantLocation.name,
            "payload":JSON.stringify(constantLocation.place)                
        })
    }
    if (entireCity){
        quickArr.push({
            "content_type":"text",
            "title":'🏙 Entire City',
            "payload":'{"city":true}'               
        })
    }
        // for more channel - enable something like that ->
        // extraQuicksArr = [botbuilder_1.CardAction.imBack(session, "productId=1&color=green", "Green")]
        //        message.suggestedActions(botbuilder_1.SuggestedActions.create(session,extraQuicksArr) )
    if (session.message.address.channelId === 'facebook'){
        quickArr.unshift({content_type: "location"})
        message
        .sourceEvent({
            facebook: {
                quick_replies: quickArr
            }
        });
    }
    else{
        message.suggestedActions(
            botbuilder_1.SuggestedActions.create(
                    session, 
                    quickArr.map((v)=>{
                        return botbuilder_1.CardAction.postBack(session, v.payload, v.title)
                    })
        ));
    }


    return session.send(message);
}
function buildLocationFromGeo(latitude, longitude) {
    var coordinates = [latitude, longitude];
    return { point: { coordinates: coordinates }, address: {} };
}
