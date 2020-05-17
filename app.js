//imports
const fetch = require('node-fetch');
const schedule = require('node-schedule');
require('dotenv').config();

// Endpoints
const TESLA_API = 'https://owner-api.teslamotors.com/api/1';
const WAKE_UP = TESLA_API + '/vehicles/' + process.env.VEHICLE_ID + '/wake_up';
const CHARGE_DATA = TESLA_API + '/vehicles/' + process.env.VEHICLE_ID + '/data_request/charge_state';
const LAMETRIC_APP = 'https://developer.lametric.com/api/v1/dev/widget/update/com.lametric.841bcbe7c608c996370936127b259216/1';

console.log('++++++ Server started, waiting for scheduled run... ++++++');

let headers = { 
    'User-Agent': '00000',
    'Content-Type': 'application/json',
    'Authorization' : 'Bearer ' + process.env.TESLA_AUTH_TOKEN
}

var runSchedule = new schedule.RecurrenceRule();
//runSchedule.hour = [7,12,5,10];
runSchedule.minute = [29];

//schedule.scheduleJob(runSchedule, runApp); // Start process

testSend();
//runApp();

async function runApp() {
    // Attempt to wake up vehicle. If it's asleep, this will retry.
    let isAwake = await wakeUpVehicle();
    console.log('isAwake: ' + isAwake);
    if(isAwake){
        // Get the charge data from the vehicle.
        let vehicleData = await getChargeData();
        // Create a JSON object to format the data for the LaMetric Time
        let lametricData = constructLametricData(vehicleData);
        // Send a POST callout to the Lametric Time Tesla App
        pushLametricData(lametricData);
    }
} 

async function wakeUpVehicle(attempt=1) {
    console.log('Attempting to wake up vehicle...');
    let res = await fetch(WAKE_UP, { method : 'POST', headers : headers });
    let data = await res.json();
    if(data.response.state != 'online'){
        if(attempt >= 6){
            // After 6 failed attempts, wait until the next run
            console.log('Vehicle did not wake up. Exiting process.' );
            return false;
        }
        // Give the vehicle 30 seconds to wake up before asking again
        console.log('Vehicle is still ' + data.response.state + '. Retrying in 30 seconds...' );
        await new Promise( (resolve) => setTimeout(resolve, 30000) );
        await wakeUpVehicle(attempt + 1);
    }
    console.log('Vehicle is a awake!');
    return true;
};

async function getChargeData() {
    console.log('Attempting to get charge data...');
    let res = await fetch(CHARGE_DATA, { method : 'GET', headers : headers })
    let data = await res.json();
    console.log('Data fetched succesfully!');
    console.log(data);
    return data; 
};

function testSend(){

    let lametricRestData = {
        'frames' : [
            {
                'text' : 'Testla',
                'icon' : 'i2735',
                'index' : 0
            }
        ]
    }

    pushLametricData(lametricRestData);

} 

function constructLametricData(data){

    let isCharging =  data.response.charger_actual_current > 0 ? true : false;
    let frames = [
        {
            'text' : 'Tesla',
            'icon' : 'i2735',
            'index' : 0
        },{
            'text' : Math.round(data.response.battery_level)+'%',
            'icon' :  getIcon(data.response.battery_level, isCharging), // Assign dynamic battery level icon
            'index' : 1
        },{
            'text' : Math.round(data.response.battery_range)+' mi',
            'icon' : 'i16716',
            'index' : 2
        }
    ];

    let lametricRestData = {
        'frames' : frames
    }
    console.log('Constructed message: ' , lametricRestData);
    return lametricRestData;
}

var getIcon = (batteryLevel,isCharging) => {

    if(!isCharging) return '3582';

    if      ( batteryLevel < 25 )   { return 'i6359'; }
    else if ( batteryLevel < 50 )   { return 'i6360'; }
    else if ( batteryLevel < 75 )   { return 'i6361'; }
    else if ( batteryLevel < 95 )   { return 'i6362'; }
    else                            { return 'i6363'; }
}

function pushLametricData (messageBody) {
    fetch(LAMETRIC_APP, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-Access-Token' :  process.env.LAMETRIC_AUTH_TOKEN,
            'Cache-Control' : 'no-cache'
        },
        body : JSON.stringify(messageBody)
    })
    .then((response) => {
        console.log('Update sent!');
        console.log(response);
        console.log('----------------------------------------------------------');
    });
}




