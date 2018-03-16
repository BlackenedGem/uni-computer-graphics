// region Global variables
// Track initialisation state
let initMain = false;
let initCounter = 0;
const INIT_AMOUNT = 5;

// Vertex/fragment shader programs
let VSHADER_SOURCE;
let FSHADER_SOURCE;

// Matrices
let modelMatrix = new Matrix4(); // The model matrix
let viewMatrix = new Matrix4();  // The view matrix
let projMatrix = new Matrix4();  // The projection matrix
let g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals

// Camera
let camera = {
    x: 0,
    y: 10,
    z: 0,
    fov: 90,
    azimuth: 0,
    altitude: 0,
    disableBounds: false
};

// Variables to track frame time/fps
// Array of last X frame times (ms), use nextFrame to determine which one to replace
let frameTimes = [];
for (let i = 1; i <= 50; i++) {
    frameTimes[i] = 0;
}
let nextFrame = 0;
let frameTimeLabel;

// Variables to keep track of lighting/user lighting selection
let lightsEnabled = [];
let lightColors = [];
let daytime = true;

let raveMode = false;
let raveColors = [];

// Constants and variables to keep track of dynamic objects
const NUM_CHAIRS = 24;
const CHAIR_MAX_MOVEMENT = 2.2;
const CHAIR_MIN_MOVEMENT = -2.4;
const CHAIR_TIMEOUT = 600;
const CHAIR_TIMEOUT_FADESTART = 120;

let doorAngle = 0;
let chairTimer = 0;
let selectedChair = -1;
let chairPositions = [];
for (let i = 0; i < NUM_CHAIRS; i++) {
    chairPositions.push(0);
}

// HTML objects
// Don't necessarily need to be global, but some do and some don't, so it's better to make them all
let webglCanvas;
let doorAngleInput;

let interfaceTopLeft;
let interfaceTopRight;
let interfaceBottomLeft;
let interfaceBottomRight;

let cbLights = [];
let cbDaytime;
let cbRave;

let btnChairsIn;
let btnChairsOut;
let btnChairsReset;

let cbDisableBounds;
let sliderFOV;
let labelFOV;

// Variable that keeps track of the mouse/canvas status
let isMouseDown = false;
let isCanvasSelected = false;

// Enums for keyboard
key = {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    U: 85,
    O: 79,
    I: 73,
    K: 75,
    UP: 40,
    DOWN: 38,
    LEFT: 37,
    RIGHT: 39
};

// Track all the key states
keyboard = {};

// Variable to store GL information and matrices to avoid constant parameter passing
let drawInfo;
const DEFAULT_AMBIENT = 0.05; // Default ambient light

//endregion

/* Setup functions */

function htmlSetup() {
    // Retrieve objects
    frameTimeLabel = document.getElementById("frametime");

    webglCanvas = document.getElementById("webgl");
    doorAngleInput = document.getElementById("doorAngleInput");

    interfaceTopLeft = document.getElementById("topleft");
    interfaceTopRight = document.getElementById("topright");
    interfaceBottomLeft = document.getElementById("bottomleft");
    interfaceBottomRight = document.getElementById("bottomright");

    cbLights.push(document.getElementById("cbLight1"));
    cbLights.push(document.getElementById("cbLight2"));
    cbLights.push(document.getElementById("cbLight3"));
    cbLights.push(document.getElementById("cbLight4"));

    cbDaytime = document.getElementById("daytime");
    cbRave = document.getElementById("rave");

    btnChairsIn = document.getElementById("tuckChairs");
    btnChairsOut = document.getElementById("pullChairs");
    btnChairsReset = document.getElementById("resetChairs");

    cbDisableBounds = document.getElementById("cbCameraBounds");
    sliderFOV = document.getElementById("FOV");
    labelFOV = document.getElementById("FOVLabel");

    // Setup functions
    document.onmousedown = function() { isMouseDown = true };
    document.onmouseup   = function() { isMouseDown = false };

    webglCanvas.onmousedown = function() { isCanvasSelected = true; };
    interfaceTopLeft.onmousedown = function() { isCanvasSelected = false; };
    interfaceTopRight.onmousedown = function() { isCanvasSelected = false; };
    interfaceBottomLeft.onmousedown = function() { isCanvasSelected = false; };
    interfaceBottomRight.onmousedown = function() { isCanvasSelected = false; };

    // Handle user input
    // Keyboard/mouse
    document.onkeydown = function(ev){
        keyboard[ev.keyCode] = true;
        keyInputNotSmooth(ev);
    };

    document.onkeyup = function(ev) {
        keyboard[ev.keyCode] = false;
    };

    document.onmousemove = function(ev) {
        mouse(ev);
    };

    // Doors/lights
    doorAngleInput.value = 0;
    doorAngleInput.oninput = function() {
        doorAngle = doorAngleInput.value;
    };

    for (let cb of cbLights) {
        lightsEnabled.push(true);
        lightColors.push(1.0, 1.0 ,1.0);
        cb.checked = true;
        cb.onclick = function() { changeLightingSelection() };
    }
    lightColors.push(1.0, 1.0 ,1.0);
    lightsEnabled.push(true);

    // Daytime
    cbDaytime.checked = true;
    cbDaytime.onclick = function() {
        daytime = cbDaytime.checked;
    };

    // Disco mode
    cbRave.checked = false;
    cbRave.onclick = function() {
        raveMode = cbRave.checked;
        updateLightIntensities(raveMode);
    };

    for (let i = 0; i < cbLights.length; i++) {
        raveColors.push(i * 500);
    }

    // Chair buttons
    btnChairsIn.onclick = function() { setAllChairs(CHAIR_MAX_MOVEMENT); };
    btnChairsOut.onclick = function() { setAllChairs(CHAIR_MIN_MOVEMENT); };
    btnChairsReset.onclick = function() { setAllChairs(0); };

    // Camera options
    cbDisableBounds.checked = false;
    cbDisableBounds.onclick = function() {
        camera.disableBounds = cbDisableBounds.checked;

    };

    sliderFOV.value = camera.fov;
    sliderFOV.oninput = function() {
        labelFOV.textContent = "FOV - " + sliderFOV.value;
        camera.fov = sliderFOV.value;
    };

    // Resized canvas
    window.addEventListener('resize', resize, false);
}

function main() {
    htmlSetup();
    loadShaders();

    // Get the rendering context for WebGL
    let gl = getWebGLContext(webglCanvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }

    // Set clear color and enable hidden surface removal
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Clear color and depth buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Get the storage locations of uniform attributes
    let u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    let u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    let u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    let u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
    let u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    let u_LightSources = gl.getUniformLocation(gl.program, 'u_LightSources');
    let u_LightIntensity = gl.getUniformLocation(gl.program, 'u_LightIntensity');
    let u_LightEnabled = gl.getUniformLocation(gl.program, 'u_LightEnabled');
    let u_LightType = gl.getUniformLocation(gl.program, 'u_LightType');
    let u_DiffuseMult = gl.getUniformLocation(gl.program, 'u_DiffuseMult');
    let u_Ambient = gl.getUniformLocation(gl.program, 'u_Ambient');
    let u_Color = gl.getUniformLocation(gl.program, 'u_Color');
    let u_UseTextures = gl.getUniformLocation(gl.program, 'u_UseTextures');
    let u_TextureRepeat = gl.getUniformLocation(gl.program, 'u_TextureRepeat');
    let u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');

    // Trigger using lighting or not
    let u_isLighting = gl.getUniformLocation(gl.program, 'u_isLighting');

    if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
        !u_ProjMatrix || !u_LightColor || !u_LightSources || !u_LightIntensity ||
        !u_LightEnabled || !u_LightType || !u_Ambient || !u_isLighting || !u_Color ||
        !u_DiffuseMult || !u_UseTextures || !u_Sampler) {
        console.log('Failed to Get the storage locations of at least one uniform');
        return;
    }

    // Set the vertex coordinates and color (for the cube)
    let n = initVertexBuffers(gl);
    if (n < 0) {
        console.log('Failed to set the vertex information');
        return;
    }

    // Reduce parameters when calling drawBox by storing in an object
    drawInfo = {
        gl: gl,
        u_ModelMatrix: u_ModelMatrix,
        u_NormalMatrix: u_NormalMatrix,
        u_Color: u_Color,
        u_isLighting: u_isLighting,
        u_LightEnabled: u_LightEnabled,
        u_Ambient: u_Ambient,
        u_LightColor: u_LightColor,
        u_LightIntensity: u_LightIntensity,
        u_DiffuseMult: u_DiffuseMult,
        u_UseTextures: u_UseTextures,
        u_TextureRepeat: u_TextureRepeat,
        u_Sampler: u_Sampler,
        n: n
    };

    initTextures(gl, n);

    camera.u_ViewMatrix = u_ViewMatrix;
    camera.u_ProjMatrix = u_ProjMatrix;

    // Set the spot light sources
    initLightSourceUniforms(gl, u_LightSources, u_LightType, u_LightColor);
    positionCamera(gl, u_ViewMatrix, u_ProjMatrix);

    initMain = true;
    initCounter++;
    resize();
    draw();
}

function resize() {
    if (!initMain) {
        return;
    }

    webglCanvas.width = window.innerWidth;
    webglCanvas.height = window.innerHeight;
    camera.aspectRatio = webglCanvas.width / webglCanvas.height;
    drawInfo.gl.viewport(0, 0, drawInfo.gl.canvas.width, drawInfo.gl.canvas.height);
}

/* Input functions */

function mouse(ev) {
    if (!isMouseDown || !isCanvasSelected) {
        return;
    }

    camera.azimuth = (camera.azimuth + ev.movementX * -0.25) % 360;

    // Don't let the camera look exactly straight up or straight down
    camera.altitude += ev.movementY * -0.25;
    if (camera.altitude > 89.9) {
        camera.altitude = 89.9;
    }
    if (camera.altitude < -89.9) {
        camera.altitude = -89.9;
    }
}

function keyInputNotSmooth(ev) {
    // Handle selection of chairs
    switch (ev.keyCode) {
        case key.U:
            selectedChair--;
            if (selectedChair < -1) {
                selectedChair = NUM_CHAIRS - 1;
            }
            chairTimer = CHAIR_TIMEOUT;
            break;
        case key.O:
            selectedChair++;
            if (selectedChair >= NUM_CHAIRS) {
                selectedChair = -1;
            }
            chairTimer = CHAIR_TIMEOUT;
            break;
    }
}

function keyInputSmooth() {
    // Camera movement
    let amount = 0.3;
    if (keyboard[key.W]) { moveCameraForwards(amount); }
    if (keyboard[key.S]) { moveCameraForwards(-amount); }
    if (keyboard[key.UP]) { moveCameraUpwards(-amount); }
    if (keyboard[key.DOWN]) { moveCameraUpwards(amount); }
    if (keyboard[key.RIGHT]) { moveCameraSideways(-amount); }
    if (keyboard[key.LEFT]) { moveCameraSideways(amount); }

    // Make sure camera is within bounds if enabled
    if (!camera.disableBounds) {
        if (camera.x < -18.5) {
            camera.x = -18.5;
        }
        if (camera.x > 18.5) {
            camera.x = 18.5;
        }
        if (camera.z < -4.5) {
            camera.z = -4.5;
        }
        if (camera.z > 32.5) {
            camera.z = 32.5;
        }
        if (camera.y < 0.5) {
            camera.y = 0.5;
        }
        if (camera.y > 16.5) {
            camera.y = 16.5;
        }
    }

    // Chair movement
    if (keyboard[key.I] && selectedChair !== -1) {
        // Move chair forwards
        chairPositions[selectedChair] += 0.1;
        if (chairPositions[selectedChair] > CHAIR_MAX_MOVEMENT) {
            chairPositions[selectedChair] = CHAIR_MAX_MOVEMENT;
        }
        chairTimer = CHAIR_TIMEOUT;
    }

    if (keyboard[key.K] && selectedChair !== -1) {
        // Move chair backwards
        chairPositions[selectedChair] -= 0.1;
        if (chairPositions[selectedChair] < CHAIR_MIN_MOVEMENT) {
            chairPositions[selectedChair] = CHAIR_MIN_MOVEMENT;
        }
        chairTimer = CHAIR_TIMEOUT;
    }

    // Update chair timer
    if (chairTimer > 0) {
        chairTimer--;

        if (chairTimer === 0) {
            selectedChair = -1;
        }
    }
}

/* Camera functions */

function moveCameraForwards(amount) {
    let x_move = Math.sin(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    let z_move = Math.cos(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    let y_move = Math.sin(degToRad(camera.altitude));

    camera.x += x_move * amount;
    camera.y += y_move * amount;
    camera.z += z_move * amount;
}

function moveCameraSideways(amount) {
    let x_move = Math.cos(degToRad(camera.azimuth));
    let z_move = Math.sin(degToRad(camera.azimuth)) * -1;

    camera.x += x_move * amount;
    camera.z += z_move * amount;
}

function moveCameraUpwards(amount) {
    /* We could move the camera upwards/downwards relative to where the camera is looking, but this is not a nice effect
    let x_move = Math.sin(degToRad(camera.azimuth)) * Math.sin(degToRad(camera.altitude));
    let z_move = Math.cos(degToRad(camera.azimuth)) * Math.sin(degToRad(camera.altitude));
    let y_move = Math.cos(degToRad(camera.altitude)) * -1;

    camera.x += x_move * amount;
    camera.z += z_move * amount; */
    camera.y += amount;
}

function positionCamera(gl) {
    // Actually position the camera with view and projection matrix
    let x_at_off = Math.sin(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    let z_at_off = Math.cos(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    let y_at_off = Math.sin(degToRad(camera.altitude));

    // Calculate the view matrix and the projection matrix
    viewMatrix.setLookAt(camera.x, camera.y, camera.z, camera.x + x_at_off, camera.y + y_at_off, camera.z + z_at_off, 0, 1, 0);
    projMatrix.setPerspective(camera.fov, camera.aspectRatio, 0.1, 100);

    // Pass the model, view, and projection matrix to the uniform variable respectively
    gl.uniformMatrix4fv(camera.u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(camera.u_ProjMatrix, false, projMatrix.elements);
}

/* Initialisation functions */

function initLightSourceUniforms(gl, u_LightSources, u_LightType) {
    // Initialises the lights with their locations, types, and intensities
    let lightSources = [
        // Position
        10.0, 15.0, 24.0,
        -10.0, 15.0, 24.0,
        10.0, 15.0, 4.0,
        -10.0, 15.0, 4.0,

        // Outside light
        50, 20, 0
    ];
    lightSources = new Float32Array(lightSources);

    let lightType = [true, true, true, true, true];

    gl.uniform3fv(u_LightSources, lightSources);
    gl.uniform1iv(drawInfo.u_LightEnabled, lightsEnabled);
    gl.uniform1iv(u_LightType, lightType);
    gl.uniform1f(drawInfo.u_DiffuseMult, 1.0);

    updateLightIntensities(false);
}

function initVertexBuffers(gl) {
    // Create a cube
    //    v6----- v5
    //   /|      /|
    //  v1------v0|
    //  | |     | |
    //  | |v7---|-|v4
    //  |/      |/
    //  v2------v3
    let vertices = new Float32Array([   // Coordinates
        0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
        0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5, // v0-v3-v4-v5 right
        0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
        -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
        -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
        0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5  // v4-v7-v6-v5 back
    ]);

    let normals = new Float32Array([    // Normal
        0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
        1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
        0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
        -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
        0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
        0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
    ]);

    let textures = new Float32Array([
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
        0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0
    ]);

    // Indices of the vertices
    let indices = new Uint8Array([
        0, 1, 2,   0, 2, 3,    // front
        4, 5, 6,   4, 6, 7,    // right
        8, 9,10,   8,10,11,    // up
        12,13,14,  12,14,15,    // left
        16,17,18,  16,18,19,    // down
        20,21,22,  20,22,23     // back
    ]);


    // Write the vertex property to buffers (coordinates, textures and normals)
    if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_TexCoord', textures, 2, gl.FLOAT)) return -1;

    // Write the indices to the buffer object
    let indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
        console.log('Failed to create the buffer object');
        return false;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return indices.length;
}

function initArrayBuffer (gl, attribute, data, num, type) {
    // Create a buffer object
    let buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return false;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Assign the buffer object to the attribute variable
    let a_attribute = gl.getAttribLocation(gl.program, attribute);
    if (a_attribute < 0) {
        console.log('Failed to get the storage location of ' + attribute);
        return false;
    }
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
    // Enable the assignment of the buffer object to the attribute variable
    gl.enableVertexAttribArray(a_attribute);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return true;
}

/* Drawing functions */

function draw() {
    if (initCounter < INIT_AMOUNT) {
        window.requestAnimationFrame(draw);
        return;
    }

    let gl = drawInfo.gl;
    let u_isLighting = drawInfo.u_isLighting;

    // Start timer
    let startTime = performance.now();

    // Change clear colour and enable/disable directional lighting depending on whether it's daytime or not
    if (daytime) {
        gl.clearColor(0.722, 0.914, 0.988, 1.0);
        lightsEnabled[lightsEnabled.length - 1] = true;
    } else {
        gl.clearColor(0, 0, 0, 1.0);
        lightsEnabled[lightsEnabled.length - 1] = false;
    }

    // Clear color and depth buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Process input and position camera
    keyInputSmooth();
    positionCamera(gl); // Position camera using the global camera object

    // Reset model matrix and set some uniforms
    modelMatrix.setTranslate(0, 0, 0);  // No Translation
    gl.uniform1i(u_isLighting, true); // Will apply lighting
    gl.uniform1f(drawInfo.u_Ambient, DEFAULT_AMBIENT);
    gl.uniform1iv(drawInfo.u_LightEnabled, lightsEnabled); // Which lights to turn on

    // Update lighting colours
    updateLightColour();

    // Draw 3 rows of chairs/tables
    for (let i = 0; i < 3; i++) {
        drawRow(drawInfo, -9, 0, 16 - (i * 8), i * 8 + 4);
        drawRow(drawInfo, 9, 0, 16 - (i * 8), i * 8);
    }

    // Draw front elements
    drawFrontDesk(drawInfo, 10.5, 0, 26.5);
    drawWhiteboard(drawInfo, -5, 9, 33, 18, 10);
    drawDoor(drawInfo, -19.5, 0, 33);

    // Draw walls and floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0, 14);  // Translation to the 'middle' of the room
    drawCeiling(drawInfo, 40, 40, 18);
    drawClassroomSides(drawInfo, 40, 40, 18);
    modelMatrix = popMatrix();

    // End timer and update
    updateFPS(performance.now() - startTime);

    // Make it so that draw is called again when needed
    window.requestAnimationFrame(draw);
}

function drawWhiteboard(drawInfo, x, y, z, width, height) {
    // Draws the whiteboard
    // x/y/z refers to the centre of the whiteboard, with the z being the very back of the whiteboard (touching the wall)
    pushMatrix(modelMatrix);

    let depth = 0.2;

    // Go to the centre of the whiteboard
    modelMatrix.translate(x, y, z);
    pushMatrix(modelMatrix);

    // Side borders - dark colour
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.2, 0.2, 0.2, 1]);

    // Left border
    modelMatrix.translate(width / 2 + 0.05, 0, (depth / -2) - 0.05);
    modelMatrix.scale(0.1, height, 0.3);
    drawBox(drawInfo);

    // Right border
    modelMatrix = topMatrix();
    modelMatrix.translate(width / -2 - 0.05, 0, (depth / -2) - 0.05);
    modelMatrix.scale(0.1, height, 0.3);
    drawBox(drawInfo);

    // Top border
    modelMatrix = topMatrix();
    modelMatrix.translate(0, height / 2 + 0.05, (depth / -2) - 0.05);
    modelMatrix.scale(width + 0.2, 0.1, 0.3);
    drawBox(drawInfo);

    // Bottom border sill
    modelMatrix = topMatrix();
    modelMatrix.translate(0, height / -2 - 0.05, (depth / -2) - 0.3);
    modelMatrix.scale(width + 0.2, 0.1, 0.8);
    drawBox(drawInfo);

    // Some pens and cleaner thingy
    modelMatrix = topMatrix();
    modelMatrix.translate(width / -2 + 1, height / -2 + 0.1, -0.5);
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [1, 0, 0, 1]);
    modelMatrix.scale(1.2, 0.2, 0.2);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(width / -2 + 2.5, height / -2 + 0.1, -0.5);
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0, 0, 1, 1]);
    modelMatrix.scale(1.2, 0.2, 0.2);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(width / -2 + 4, height / -2 + 0.1, -0.5);
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0, 0, 0, 1]);
    modelMatrix.scale(1.2, 0.2, 0.2);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(width / 2 - 1.2, height / -2 + 0.25, -0.5);
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.5, 0.5, 0.5, 1]);
    modelMatrix.scale(2, 0.5, 0.5);
    drawBox(drawInfo);

    // The whiteboard
    // Surprisingly uses the colour white
    // We make it a bit lighter using u_DiffuseMultiplier
    modelMatrix = topMatrix();
    enableTextures(0);
    if (daytime) {
        drawInfo.gl.uniform1f(drawInfo.u_DiffuseMult, 1.4);
    } else {
        drawInfo.gl.uniform1f(drawInfo.u_DiffuseMult, 1.5);
    }
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [1, 1, 1, 1]);
    modelMatrix.translate(0, 0, depth / -2);
    modelMatrix.scale(width, height, depth);
    drawBox(drawInfo);
    disableTextures();
    drawInfo.gl.uniform1f(drawInfo.u_DiffuseMult, 1.0);

    popMatrix();
    modelMatrix = popMatrix();
}

function drawDoor(drawInfo, x, y, z) {
    let depth = 0.6;
    let width = 5;
    let height = 12;

    // Rotation/translation
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);
    modelMatrix.rotate(-doorAngle, 0, 1, 0);

    // Door piece
    pushMatrix(modelMatrix);
    enableTextures(4);
    modelMatrix.translate(depth / -2, height / 2, width / -2);
    modelMatrix.rotate(180, 0, 0, 1);
    modelMatrix.scale(depth, height, width); // Scale
    drawBox(drawInfo);
    disableTextures();

    // Handle
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.573, 0.502, 0.137, 1]);
    modelMatrix = popMatrix();
    modelMatrix.translate(depth / -2, 3.5, - (width - 1));
    modelMatrix.scale(depth + 0.7, 0.4, 0.4); // Scale
    drawBox(drawInfo);

    modelMatrix = popMatrix();
}

function drawFrontDesk(drawInfo, x, y, z) {
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);

    drawTable(drawInfo, 0, 0, 0, 9, [0.788, 0.776, 1, 1]); // Light blue

    modelMatrix.translate(2, 0, 4);
    modelMatrix.rotate(235, 0, 1, 0);
    drawChair(drawInfo, 0, 0, 0, [0.878, 0.165, 0.165, 1]); // Red

    modelMatrix = popMatrix();
}

function drawCeiling(drawInfo, width, depth, height) {
    // Set the colour to Blue
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.859, 0.961, 1, 1]);

    // Save the matrix in the middle of the floor
    pushMatrix(modelMatrix);

    // Model the floor
    modelMatrix.translate(0, height + 0.5, 0);
    modelMatrix.scale(width, 1, depth); // Scale
    drawBox(drawInfo);

    // Model lights
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    let lightOffsets = [1, 1, -1, 1, 1, -1, -1, -1];

    let lightOffsetX = (width / 4);
    let lightOffsetZ = (depth / 4);

    // Iterate over the lights
    for (let i = 0; i < lightOffsets.length; i += 2) {
        modelMatrix = topMatrix();
        modelMatrix.translate(lightOffsetX * lightOffsets[i], height - 0.5, lightOffsetZ * lightOffsets[i + 1]);  // Translation
        modelMatrix.scale(2.5, 1.0, 2.5); // Scale

        // Change the colour depending on whether the light is on or not
        if (lightsEnabled[i / 2]) {
            // Different colour if we're using rave mode
            if (raveMode) {
                let raveColor = HSVtoRGB(raveColors[i / 2] / 2000, 1.0, 1.0);
                raveColor.push(1.0);
                drawInfo.gl.uniform4fv(drawInfo.u_Color, raveColor);
            } else {
                drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.976, 1, 0.757, 1]);
            }

            drawInfo.gl.uniform1f(drawInfo.u_Ambient, 0.4);
        } else {
            drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.8, 0.8, 0.8, 1]);
            drawInfo.gl.uniform1f(drawInfo.u_Ambient, DEFAULT_AMBIENT);
        }

        drawBox(drawInfo);
    }

    drawInfo.gl.uniform1f(drawInfo.u_Ambient, DEFAULT_AMBIENT);
    modelMatrix = popMatrix();
}

function drawClassroomSides(drawInfo, width, depth, height) {
    // Save the matrix in the middle of the floor
    pushMatrix(modelMatrix);

    // Set the colour to Red
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.749, 0.341, 0.341, 1]);

    // Model the floor
    enableTextures(1, 15);
    modelMatrix.translate(0, -0.5, 0);
    modelMatrix.rotate(90, 1, 0, 0);
    modelMatrix.scale(width, depth, 1); // Scale
    drawBox(drawInfo);
    disableTextures();

    // Set the colour to Blue
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.859, 0.961, 1, 1]);

    // Model the back wall
    modelMatrix = topMatrix();
    modelMatrix.translate(0, height / 2, (depth / -2) + 0.5);
    modelMatrix.scale(width, height, 1); // Scale
    drawBox(drawInfo);
    // Model the front wall
    modelMatrix.translate(0, 0, depth - 1);
    drawBox(drawInfo);

    // Model the side wall without windows. Needs two pieces because of the door
    modelMatrix = topMatrix();
    modelMatrix.translate((width / -2) + 0.5, height / 2, -3);
    modelMatrix.scale(1, height, depth - 6);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate((width / -2) + 0.5, (height + 12) / 2, (depth / 2) - 3);
    modelMatrix.scale(1, height - 12, 6);
    drawBox(drawInfo);

    // Draw the 'hallway' for when the door is opened
    modelMatrix = topMatrix();
    enableTextures(2);
    modelMatrix.translate((width / -2) - 0.5, 6, (depth / 2) - 3.5);
    modelMatrix.rotate(270, 0, 1, 0);
    modelMatrix.scale(5, 12, 1);
    drawBox(drawInfo);
    disableTextures();

    // Draw the wall with windows
    modelMatrix = topMatrix();
    modelMatrix.translate((width / 2) - 0.5, 0, 0);
    drawWallWithWindows(drawInfo, depth, height, 15, 5, 2);

    // Return back to origin
    modelMatrix = popMatrix();
}

function drawWallWithWindows(drawInfo, depth, height, windowWidth, heightFromFloor, heightFromTop) {
    pushMatrix(modelMatrix);

    // Top and bottom sections
    modelMatrix.translate(0, heightFromFloor / 2, 0);
    modelMatrix.scale(1, heightFromFloor, depth);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(0, height - (heightFromTop / 2), 0);
    modelMatrix.scale(1, heightFromTop, depth);
    drawBox(drawInfo);

    // Dividers
    let dividerWidth = (depth - (windowWidth * 2)) / 3;
    let dividerTranslate = (depth / 2) - (dividerWidth / 2);

    // Create the three diviers iteratively
    for (let i = -1; i <= 1; i++) {
        modelMatrix = topMatrix();
        modelMatrix.translate(0, height / 2, i * dividerTranslate);
        modelMatrix.scale(1, height, dividerWidth);
        drawBox(drawInfo);
    }

    let windowHeight = height - (heightFromFloor + heightFromTop);
    let windowCentreWidth = (dividerWidth + windowWidth) / 2;
    let windowCentreHeight = heightFromFloor + (windowHeight / 2);

    // Create the two windows
    modelMatrix = topMatrix();
    modelMatrix.translate(0, windowCentreHeight, windowCentreWidth);
    drawWindow(drawInfo, windowWidth, windowHeight);

    modelMatrix = topMatrix();
    modelMatrix.translate(0, windowCentreHeight, -windowCentreWidth);
    drawWindow(drawInfo, windowWidth, windowHeight);

    popMatrix();
}

function drawWindow(drawInfo, width, height) {
    pushMatrix(modelMatrix);

    let borderThickness = 0.2;

    // Side borders - Brown colour
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.396, 0.263, 0.129, 1]);

    modelMatrix.translate(0, 0, (width - borderThickness) / 2);
    modelMatrix.scale(1.2, height, borderThickness);
    drawBox(drawInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(0, 0, (width - borderThickness) / -2);
    modelMatrix.scale(1.3, height - borderThickness, borderThickness);
    drawBox(drawInfo);

    // Top border
    modelMatrix = topMatrix();
    modelMatrix.translate(0, (height - borderThickness) / 2, 0);
    modelMatrix.scale(1.3, borderThickness, width);
    drawBox(drawInfo);

    // Window sill
    modelMatrix = topMatrix();
    modelMatrix.translate(0, (height - borderThickness) / -2, 0);
    modelMatrix.scale(2, borderThickness, width);
    drawBox(drawInfo);

    // The glass pane
    // Blueish with alpha value
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.788, 0.867, 1, 0.03]);
    modelMatrix = topMatrix();
    modelMatrix.scale(0.4, height, width);
    drawBox(drawInfo);

    modelMatrix = popMatrix();
}

function drawRow(drawInfo, x, y, z, chairIDOffset) {
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);  // Translation

    for (let i = 0; i < 4; i++) {
        drawChair(drawInfo, 4.5 - (i * 3), 0, 0, null, chairIDOffset + i);
    }

    drawTable(drawInfo, -3.05, 0, 3, null, null, true);
    drawTable(drawInfo, 3.05, 0, 3, null, null, true);

    modelMatrix = popMatrix();
}

function drawTable(drawInfo, x, y, z, width, colour, useTexture = false) {
    // Default values
    if (!colour) {
        colour = [0.824, 0.706, 0.549, 1]; // Browny colour
    }
    if (!width) {
        width = 6;
    }

    drawInfo.gl.uniform4fv(drawInfo.u_Color, colour);

    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y + 3.25, z);  // Translation

    // Model the table top
    // Use a texture if variable set
    if (useTexture) {
        enableTextures(3);
    }
    pushMatrix(modelMatrix);
    modelMatrix.scale(width, 0.3, 3.0); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();
    if (useTexture) {
        disableTextures();
    }

    // Set the leg colour to dark grey
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.3, 0.3, 0.3, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    let legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];
    let widthOffset = (width / 2) - 0.25;

    for (let i = 0; i < legOffsets.length; i += 2) {
        pushMatrix(modelMatrix);
        modelMatrix.translate(widthOffset * legOffsets[i], -1.7, 1.25 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 3.1, 0.4); // Scale
        drawBox(drawInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawChair(drawInfo, x, y, z, colour, chairID = -2) {
    pushMatrix(modelMatrix);

    // Default colour value
    if (!colour) {
        colour = [0.137, 0.576, 0.278, 1]; // Green colour
    }
    // Set the seat colour
    drawInfo.gl.uniform4fv(drawInfo.u_Color, colour);

    // Increase ambient lighting if chair is selected
    if (chairID === selectedChair) {
        let extraAmbient = 0.5;
        if (chairTimer < CHAIR_TIMEOUT_FADESTART) {
            extraAmbient *= (chairTimer / CHAIR_TIMEOUT_FADESTART);
        }

        drawInfo.gl.uniform1f(drawInfo.u_Ambient, extraAmbient);
    }

    // Translate chair according to user input
    let chairOffset = 0;
    if (chairID >= 0) {
        chairOffset = chairPositions[chairID]
    }
    modelMatrix.translate(x, y, z + chairOffset);  // Translation

    // Model the chair seat
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 2.1, 0);
    modelMatrix.scale(2.0, 0.2, 2.0); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();

    // Model the chair back
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 3.25, -0.925);  // Translation
    modelMatrix.scale(2.0, 2.5, 0.15); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.5, 0.5, 0.5, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    let legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];

    for (let i = 0; i < legOffsets.length; i += 2) {
        pushMatrix(modelMatrix);
        modelMatrix.translate(0.75 * legOffsets[i], 1.0 , 0.75 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.25, 2.0, 0.25); // Scale
        drawBox(drawInfo);
        modelMatrix = popMatrix();
    }

    // Revert ambient lighting if chair is selected
    if (chairID === selectedChair) {
        drawInfo.gl.uniform1f(drawInfo.u_Ambient, DEFAULT_AMBIENT);
    }

    modelMatrix = popMatrix();
}

function drawBox(drawInfo) {
    let gl = drawInfo.gl;
    let u_ModelMatrix = drawInfo.u_ModelMatrix;
    let u_NormalMatrix = drawInfo.u_NormalMatrix;
    let num_vertices = drawInfo.n;

    // Pass the model matrix to the uniform variable
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix.setInverseOf(modelMatrix);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

    // Draw the cube
    gl.drawElements(gl.TRIANGLES, num_vertices, gl.UNSIGNED_BYTE, 0);
}

/* Matrix functions */
let g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
    let m2 = new Matrix4(m);
    g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
    return g_matrixStack.pop();
}

function topMatrix() {
    return new Matrix4(g_matrixStack[g_matrixStack.length - 1]);
}

/* Update functions */

function setAllChairs(value) {
    for (let i = 0; i < chairPositions.length; i++) {
        chairPositions[i] = value;
    }
}

function updateFPS(renderTime) {
    frameTimes[nextFrame] = renderTime;
    nextFrame++;

    // Reset and update
    if (nextFrame >= frameTimes.length) {
        nextFrame = 0;

        let totTime = sumArray(frameTimes);
        let frameTime = totTime / frameTimes.length;

        frameTimeLabel.innerText = "Avg. Frame Time: " + frameTime.toFixed(2) + "ms";
    }
}

function changeLightingSelection() {
    // Change the array determining which lights are turned on
    for (let i = 0; i < cbLights.length; i++) {
        lightsEnabled[i] = cbLights[i].checked;
    }
}

function updateLightIntensities(raveMode = false) {
    let dropoff = 10.0;
    let intensity = 1.2;

    if (raveMode) {
        intensity = 1.0;
        dropoff = 13.0;
    }

    let lightIntensities = new Float32Array([
        // Positional lights
        intensity, dropoff,
        intensity, dropoff,
        intensity, dropoff,
        intensity, dropoff,

        // Directional light
        3, 30
    ]);

    drawInfo.gl.uniform2fv(drawInfo.u_LightIntensity, lightIntensities);
}

function updateLightColour() {
    if (raveMode) {
        // Increment colours
        for (let i = 0; i < raveColors.length; i++) {
            raveColors[i] += 10;

            if (raveColors[i] > 2000) {
                raveColors[i] -= 2000;
            }
        }

        // Set lights colours
        for (let i = 0; i < cbLights.length; i++) {
            [r, g, b] = HSVtoRGB(raveColors[i] / 2000.0, 1.0, 1.0);

            lightColors[i * 3] = r;
            lightColors[i * 3 + 1] = g;
            lightColors[i * 3 + 2] = b;
        }
    } else {
        // Set lights to all white
        for (let i = 0; i < cbLights.length * 3; i++) {
            lightColors[i] = 1.0;
        }
    }

    // Put into uniform
    drawInfo.gl.uniform3fv(drawInfo.u_LightColor, lightColors);
}

/* Render helper functions */

function enableTextures(textureID, repeat = 1) {
    drawInfo.gl.uniform1i(drawInfo.u_UseTextures, true);
    drawInfo.gl.uniform1f(drawInfo.u_TextureRepeat, repeat);
    drawInfo.gl.uniform1i(drawInfo.u_Sampler, textureID);
}

function disableTextures() {
    drawInfo.gl.uniform1i(drawInfo.u_UseTextures, false);
}

/* Load files */

function loadShaders() {
    VSHADER_SOURCE = loadLocalFile('vertex shader.glsl');
    FSHADER_SOURCE = loadLocalFile('fragment shader.glsl');
}

function initTextures(gl) {
    loadTexture("whiteboard.png", gl.TEXTURE0, drawInfo.u_Sampler);
    loadTexture("carpet.jpg", gl.TEXTURE1, drawInfo.u_Sampler, true);
    loadTexture("hallway.jpg", gl.TEXTURE2, drawInfo.u_Sampler);
    loadTexture("wood.jpg", gl.TEXTURE3, drawInfo.u_Sampler);
    loadTexture("door.jpg", gl.TEXTURE4, drawInfo.u_Sampler);

    return true;
}

function loadTexture(src, textureBinder, u_Sampler, repeat = false) {
    let texture = drawInfo.gl.createTexture();

    if (!texture) {
        console.log("Could not create texture");
    }

    let image = new Image();
    image.onload = function() {
        onLoadTexture(drawInfo.gl, drawInfo.n, texture, u_Sampler, image, textureBinder, repeat);
    };
    image.src = src;
}

function onLoadTexture(gl, n, texture, u_Sampler, image, bindTexture, repeat) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    gl.activeTexture(bindTexture);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    if (repeat) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Increment initialisation counter
    initCounter++;
}