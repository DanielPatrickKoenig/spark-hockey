
const Scene = require('Scene');
const Patches = require('Patches');

// Use export keyword to make a symbol available in scripting debug console
export const Diagnostics = require('Diagnostics');

const positionScale = -1000;
const bouncerCount = 4;
let barPosition = {x: 0, y: 0, _y: 0};
let bouncers = [];
let speeds = [];
let angles = [];
let lastBounceList = [];
let hits = [];
let saves = 0;

for(let i = 0; i < bouncerCount; i++){
    lastBounceList.push(-1);
    bouncers.push({x: getRandomX(), y: 0});
    angles.push(getRandomAngle());
    speeds.push(getRandomSpeed());
    hits.push({x: false, y: false, saveStopper: -10});
}

const maxCycles = 300;
let cycleCount = 0;

let speed = 5;
const bounceTypes = {
    LEFT: 0,
    RIGHT: 1,
    TOP: 2,
    BOTTOM: 3
};
let gameWidth;
let gameHeight;
// Patches.outputs.getScalar('game_width').then(function (r) {
//     r.monitor().subscribe(function (value) {
//         Diagnostics.log(value.newValue);
//     });
// });
Scene.root.findFirst('sizer').then(function (r) {
    r.transform.position.x.monitor().subscribe(function (_value) {
        gameWidth = _value.newValue * 2;
    });
    r.transform.position.y.monitor().subscribe(function (_value) {
        gameHeight = _value.newValue * 2;
    });
    Scene.root.findFirst('canvas0').then(function (r) {
        const canvasBounds = r.bounds;
        Patches.inputs.setScalar('bar_top_alt', canvasBounds.height.mul(.7));
        Patches.inputs.setScalar('horizontal_center', canvasBounds.width.mul(.5));
        Patches.inputs.setScalar('vertical_center', canvasBounds.height.mul(.5));
        const barWidthRatio = .2;
        Patches.inputs.setScalar('bar_width', canvasBounds.width.mul(barWidthRatio));
        Patches.inputs.setScalar('bar_height', canvasBounds.width.mul(barWidthRatio/2));
        Patches.inputs.setScalar('bouncer_width', canvasBounds.width.mul(.05));
        Patches.inputs.setScalar('bouncer_height', canvasBounds.width.mul(.05));
        Patches.inputs.setScalar('offset', canvasBounds.width.mul(barWidthRatio/-2));
        Scene.root.findFirst('positionTracker').then(function (result) {
            result.worldTransform.position.x.monitor().subscribe(function (value) {
                const barLeft = value.newValue;
                barPosition.x = (barLeft * positionScale) + (gameWidth / 2) - ((gameWidth * barWidthRatio) / 2);
                Patches.inputs.setScalar('bar_left', barLeft * positionScale); 
            });
        });
        
        Scene.root.findFirst('verticalTracker').then(function (result) {
            result.worldTransform.position.y.monitor().subscribe(function (value) {
                const barTop = value.newValue;
                barPosition._y = (barTop * positionScale);
                Patches.inputs.setScalar('bar_top', barPosition._y);
            });
        });
        Scene.root.findFirst('timeTracker').then(function (result) {
            result.worldTransform.rotation.x.monitor().subscribe(function (value) {
                tick(value, maxCycles); 
            });
        });
        for(let index = 0; index < bouncers.length; index++)
        {
            Scene.root.findFirst(`bouncer_${index}`).then((result) => {
                result.transform.position.x.monitor().subscribe((value) => {
                    
                    if(value.newValue < 0){
                        bounce(bounceTypes.LEFT, index);
                    }
                    else if(value.newValue > gameWidth){
                        bounce(bounceTypes.RIGHT, index);
                    }
                    const barWidth = gameWidth * barWidthRatio;
                    hits[index].x = value.newValue > barPosition.x && value.newValue < barPosition.x + barWidth;
                });
            });
            Scene.root.findFirst(`bouncer_${index}`).then((result) => {
                result.transform.position.y.monitor().subscribe((value) => {
                    if(value.newValue < 0){
                        bounce(bounceTypes.TOP, index);
                    }
                    else if(value.newValue > gameHeight){
                        bounce(bounceTypes.BOTTOM, index);
                    }
                    const barHeight = gameHeight * (barWidthRatio / 2);
                    barPosition.y = gameHeight * .7;
                    // Diagnostics.log(barPosition.y);
                    hits[index].y = value.newValue > barPosition.y && value.newValue < barPosition.y + barHeight;
                });
            });
        }
        
    });
});

function tick(value, cycleMax){
    for(let index = 0; index < bouncers.length; index++)
    {
        if(cycleMax * index < cycleCount){
            bouncers[index].x = getOrbit(bouncers[index].x, speeds[index], angles[index], 'cos');
            bouncers[index].y = getOrbit(bouncers[index].y, speeds[index], angles[index], 'sin');
            // Diagnostics.log(bouncer);
            
            Patches.inputs.setScalar(`bouncer_left_${index}`, bouncers[index].x);
            Patches.inputs.setScalar(`bouncer_top_${index}`, bouncers[index].y);
        }
        if(hits[index].x && hits[index].y){
            
            if(hits[index].saveStopper > 1){
                saves++;
                hits[index].saveStopper = -2;
                Diagnostics.log(saves);
            }
            resetBouncer(index);
        }
        hits[index].saveStopper++;
        cycleCount++;
    }
}

function bounce(type, index){
    if(type != lastBounceList[index]){
        lastBounceList[index] = type;
        // Diagnostics.log((angles[index] + 360) % 360);
        const plottedNext = {x: getOrbit(bouncers[index].x, speeds[index], angles[index], 'cos'), y: getOrbit(bouncers[index].y, speeds[index], angles[index], 'sin')};
        switch(type){
            case bounceTypes.LEFT:{
                const xDistToLast = (bouncers[index].x - plottedNext.x) * 2;
                const angledNext = {x: plottedNext.x + xDistToLast, y: plottedNext.y};
                angles[index] = getAngle(bouncers[index].x, bouncers[index].y, angledNext.x, angledNext.y);
                // Diagnostics.log('LEFT');
                break;
            }
            case bounceTypes.RIGHT:{
                const xDistToLast = (plottedNext.x - bouncers[index].x) * 2;
                const angledNext = {x: plottedNext.x - xDistToLast, y: plottedNext.y};
                angles[index] = getAngle(bouncers[index].x, bouncers[index].y, angledNext.x, angledNext.y);
                
                // Diagnostics.log('RIGHT');
                break;
            }
            // case bounceTypes.TOP:{
            //     const yDistToLast = (bouncers[index].y - plottedNext.y) * 2;
            //     const angledNext = {x: plottedNext.x, y: plottedNext.y + yDistToLast};
            //     angles[index] = getAngle(bouncers[index].x, bouncers[index].y, angledNext.x, angledNext.y);
            //     Diagnostics.log('TOP');
            //     break;
            // }
            case bounceTypes.BOTTOM:{
                resetBouncer(index);
                // const yDistToLast = (plottedNext.y - bouncers[index].y) * 2;
                // const angledNext = {x: plottedNext.x, y: plottedNext.y - yDistToLast};
                // angles[index] = getAngle(bouncers[index].x, bouncers[index].y, angledNext.x, angledNext.y);
                // Diagnostics.log('BOTTOM');
                break;
            }
        }
    }
    
}

function resetBouncer(index){
    bouncers[index] = {x: getRandomX(), y: -1};
    angles[index] = getRandomAngle();
    speeds[index] = getRandomSpeed();
    lastBounceList[index] = -1;
}

function getRandomX(){
    return Math.random()*gameWidth;   
}

function getRandomAngle(){
    return 180 + (Math.random() * 60) - 30;
}

function getRandomSpeed(){
    return (Math.random() * 6) + 12;
}

function getDistance(x1, y1, x2, y2) {

    var distx = x2 - x1;
    var disty = y2 - y1;
    return Math.sqrt(Math.pow(distx, 2) + Math.pow(disty, 2));
}
function getAngle(x1, y1, x2, y2) {

    var distx = x2 - x1;
    var disty = y2 - y1;
    var masterdist = getDistance(x1, y1, x2, y2);
    var primary_anglex = distx / masterdist;
    var anglex = Math.asin(primary_anglex) * 180 / Math.PI;
    var primary_angley = disty / masterdist;
    var angley = Math.asin(primary_angley) * 180 / Math.PI;
    var resultVal;
    if (disty < 0) {
        resultVal = anglex;
    }
    else if (disty >= 0 && distx >= 0) {
        resultVal = angley + 90;
    }
    else if (disty >= 0 && distx < 0) {
        resultVal = (angley * -1) - 90;
    }
    return resultVal;
}
function getOrbit(_center, _radius, _angle, orbitType) {

    var _num1 = _center;
    var _num2 = _radius;
    var _num3 = _angle;
    var theCent = _num1;
    var radius = _num2;
    var angle = _num3 - 90;
    var ot = orbitType;
    var resultVal;
    if (ot == "cos") {
        resultVal = theCent + (Math.cos((angle) * (Math.PI / 180)) * radius);
    }
    if (ot == "sin") {
        resultVal = theCent + (Math.sin((angle) * (Math.PI / 180)) * radius);
    }
    return resultVal;
}

// Enables async/await in JS [part 1]
(async function() {
    

// To use variables and functions across files, use export/import keyword
// export const animationDuration = 10;

// Use import keyword to import a symbol from another file
// import { animationDuration } from './script.js'

// To access scene objects
// const [directionalLight] = await Promise.all([
//   Scene.root.findFirst('directionalLight0')
// ]);

// To access class properties
// const directionalLightIntensity = directionalLight.intensity;

// To log messages to the console
// Diagnostics.log('Console message logged from the script.');

// Enables async/await in JS [part 2]
})();
