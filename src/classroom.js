// Vertex shader program
var VSHADER_SOURCE = loadLocalFile('vertex shader.glsl');

// Fragment shader program
var FSHADER_SOURCE = loadLocalFile('fragment shader.glsl');

var modelMatrix = new Matrix4(); // The model matrix
var viewMatrix = new Matrix4();  // The view matrix
var projMatrix = new Matrix4();  // The projection matrix
var g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals

// Camera
var camera = {
    x: 0,
    y: 10,
    z: 0,
    fov: 90,
    azimuth: 0,
    altitude: 0
};

// Variables to track frame time/fps
// Array of last X frame times (ms), use nextFrame to determine which one to replace
var frameTimes = [];
for (var i = 1; i <= 50; i++) {
    frameTimes[i] = 0;
}
var nextFrame = 0;
var frameTimeLabel;

// Variables to keep track of dynamic objects
var doorAngle = 0;

// HTML objects
var webglCanvas = document.getElementById("webgl");
var doorAngleInput = document.getElementById("doorAngleInput");

// Variable that keeps track of the mouses status
var isMouseDown = false;
document.onmousedown = function() { isMouseDown = true };
document.onmouseup   = function() { isMouseDown = false };
var isCanvasSelected = false;
webglCanvas.onmousedown = function() { isCanvasSelected = true; };
doorAngleInput.onmousedown = function() { isCanvasSelected = false; };

// Enums for key
key = {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    UP: 40,
    DOWN: 38,
    LEFT: 37,
    RIGHT: 39
};

// Variable to store GL information and matrices to avoid constant parameter passing
var drawInfo;

function main() {
    // Retrieve frametime
    frameTimeLabel = document.getElementById("frametime");

    // Get the rendering context for WebGL
    var gl = getWebGLContext(webglCanvas);
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
    gl.clearColor(0.788, 0.867, 1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Clear color and depth buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Get the storage locations of uniform attributes
    var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    var u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    var u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
    var u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    var u_LightSources = gl.getUniformLocation(gl.program, 'u_LightSources');
    var u_LightEnabled = gl.getUniformLocation(gl.program, 'u_LightEnabled');
    var u_Color = gl.getUniformLocation(gl.program, 'u_Color');

    // Trigger using lighting or not
    var u_isLighting = gl.getUniformLocation(gl.program, 'u_isLighting');

    /*
    if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
        !u_ProjMatrix || !u_LightColor || !u_LightPosition ||
        !u_isLighting || !u_Color) {
        console.log('Failed to Get the storage locations of at least one uniform');
        return;
    }*/ // Disabled because it doesn't actually work properly

    camera.u_ViewMatrix = u_ViewMatrix;
    camera.u_ProjMatrix = u_ProjMatrix;

    // Set the light color (white)
    gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
    // Set the spot light sources
    initLightSourceUniforms(gl, u_LightSources, u_LightEnabled);

    positionCamera(gl, u_ViewMatrix, u_ProjMatrix);

    // Handle user input
    document.onkeydown = function(ev){
        keydown(ev);
    };

    document.onmousemove = function(ev) {
        mouse(ev);
    };

    doorAngleInput.value = 0;
    doorAngleInput.oninput = function() {
        doorAngle = doorAngleInput.value;
    };

    // Reduce parameters when calling drawBox by storing in an object
    drawInfo = {
        gl: gl,
        u_ModelMatrix: u_ModelMatrix,
        u_NormalMatrix: u_NormalMatrix,
        u_Color: u_Color,
        u_isLighting: u_isLighting
    };

    draw();
}

function resize() {
    webglCanvas.width = window.innerWidth;
    webglCanvas.height = window.innerHeight;
    camera.aspectRatio = webglCanvas.width / webglCanvas.height;
}
window.addEventListener('resize', resize, false); resize();

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

function keydown(ev) {
    switch (ev.keyCode) {
        case key.W:
            moveCameraForwards(1);
            break;
        case key.S:
            moveCameraForwards(-1);
            break;
        case key.UP:
            moveCameraUpwards(-1);
            break;
        case key.DOWN:
            moveCameraUpwards(1);
            break;
        case key.RIGHT:
            moveCameraSideways(-1);
            break;
        case key.LEFT:
            moveCameraSideways(1);
            break;
        default: return; // Skip drawing at no effective action
    }
}

function moveCameraForwards(amount) {
    var x_move = Math.sin(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    var z_move = Math.cos(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    var y_move = Math.sin(degToRad(camera.altitude));

    camera.x += x_move * amount;
    camera.y += y_move * amount;
    camera.z += z_move * amount;
}

function moveCameraSideways(amount) {
    var x_move = Math.cos(degToRad(camera.azimuth));
    var z_move = Math.sin(degToRad(camera.azimuth)) * -1;

    camera.x += x_move * amount;
    camera.z += z_move * amount;
}

function moveCameraUpwards(amount) {
    /* We could move the camera upwards/downwards relative to where the camera is looking, but this is not a nice effect
    var x_move = Math.sin(degToRad(camera.azimuth)) * Math.sin(degToRad(camera.altitude));
    var z_move = Math.cos(degToRad(camera.azimuth)) * Math.sin(degToRad(camera.altitude));
    var y_move = Math.cos(degToRad(camera.altitude)) * -1;

    camera.x += x_move * amount;
    camera.z += z_move * amount; */
    camera.y += amount;
}

// Actually position the camera with view and projection matrix
function positionCamera(gl) {
    var x_at_off = Math.sin(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    var z_at_off = Math.cos(degToRad(camera.azimuth)) * Math.cos(degToRad(camera.altitude));
    var y_at_off = Math.sin(degToRad(camera.altitude));

    // Calculate the view matrix and the projection matrix
    viewMatrix.setLookAt(camera.x, camera.y, camera.z, camera.x + x_at_off, camera.y + y_at_off, camera.z + z_at_off, 0, 1, 0);
    projMatrix.setPerspective(camera.fov, camera.aspectRatio, 0.1, 100);

    // Pass the model, view, and projection matrix to the uniform variable respectively
    gl.uniformMatrix4fv(camera.u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(camera.u_ProjMatrix, false, projMatrix.elements);
}

function initLightSourceUniforms(gl, u_LightSources, u_LightEnabled) {
    var lightSources = new Float32Array([   // Coordinates
        10.0, 20.0, 5.0, 10.0,
        -10.0, 20.0, 25.0, 10.0
    ]);

    var lightEnabled = [true, true];

    gl.uniform4fv(u_LightSources, lightSources);
    gl.uniform1iv(u_LightEnabled, lightEnabled);
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
    var vertices = new Float32Array([   // Coordinates
        0.5, 0.5, 0.5,  -0.5, 0.5, 0.5,  -0.5,-0.5, 0.5,   0.5,-0.5, 0.5, // v0-v1-v2-v3 front
        0.5, 0.5, 0.5,   0.5,-0.5, 0.5,   0.5,-0.5,-0.5,   0.5, 0.5,-0.5, // v0-v3-v4-v5 right
        0.5, 0.5, 0.5,   0.5, 0.5,-0.5,  -0.5, 0.5,-0.5,  -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
        -0.5, 0.5, 0.5,  -0.5, 0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
        -0.5,-0.5,-0.5,   0.5,-0.5,-0.5,   0.5,-0.5, 0.5,  -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
        0.5,-0.5,-0.5,  -0.5,-0.5,-0.5,  -0.5, 0.5,-0.5,   0.5, 0.5,-0.5  // v4-v7-v6-v5 back
    ]);


    var normals = new Float32Array([    // Normal
        0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
        1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
        0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
        -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
        0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,   0.0,-1.0, 0.0,  // v7-v4-v3-v2 down
        0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0,   0.0, 0.0,-1.0   // v4-v7-v6-v5 back
    ]);


    // Indices of the vertices
    var indices = new Uint8Array([
        0, 1, 2,   0, 2, 3,    // front
        4, 5, 6,   4, 6, 7,    // right
        8, 9,10,   8,10,11,    // up
        12,13,14,  12,14,15,    // left
        16,17,18,  16,18,19,    // down
        20,21,22,  20,22,23     // back
    ]);


    // Write the vertex property to buffers (coordinates, colors and normals)
    if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Normal', normals, 3, gl.FLOAT)) return -1;

    // Write the indices to the buffer object
    var indexBuffer = gl.createBuffer();
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
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return false;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Assign the buffer object to the attribute variable
    var a_attribute = gl.getAttribLocation(gl.program, attribute);
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

function initAxesVertexBuffers(gl) {
    var verticesColors = new Float32Array([
        // Vertex coordinates and color (for axes)
        -50.0,  0.0,   0.0,  1.0,  1.0,  1.0,  // (x,y,z), (r,g,b)
        50.0,  0.0,   0.0,  1.0,  1.0,  1.0,
        0.0,  50.0,   0.0,  1.0,  1.0,  1.0,
        0.0, -50.0,   0.0,  1.0,  1.0,  1.0,
        0.0,   0.0, -50.0,  1.0,  1.0,  1.0,
        0.0,   0.0,  50.0,  1.0,  1.0,  1.0
    ]);
    var n = 6;

    // Create a buffer object
    var vertexColorBuffer = gl.createBuffer();
    if (!vertexColorBuffer) {
        console.log('Failed to create the buffer object');
        return false;
    }

    // Bind the buffer object to target
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verticesColors, gl.STATIC_DRAW);

    var FSIZE = verticesColors.BYTES_PER_ELEMENT;
    //Get the storage location of a_Position, assign and enable buffer
    var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    if (a_Position < 0) {
        console.log('Failed to get the storage location of a_Position');
        return -1;
    }
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, FSIZE * 6, 0);
    gl.enableVertexAttribArray(a_Position);  // Enable the assignment of the buffer object

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return n;
}

var g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
    var m2 = new Matrix4(m);
    g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
    return g_matrixStack.pop();
}

function topMatrix() {
    return new Matrix4(g_matrixStack[g_matrixStack.length - 1]);
}

function draw() {
    var gl = drawInfo.gl;
    var u_ModelMatrix = drawInfo.u_ModelMatrix;
    var u_Color = drawInfo.u_Color;
    var u_isLighting = drawInfo.u_isLighting;

    // Start timer
    var startTime = performance.now();

    // Clear color and depth buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    positionCamera(gl); // Position camera using the global camera object
    gl.uniform1i(u_isLighting, false); // Will not apply lighting

    // Set the vertex coordinates and color (for the x, y axes)
    var n = initAxesVertexBuffers(gl);
    if (n < 0) {
        console.log('Failed to set the vertex information');
        return;
    }

    // Calculate the view matrix and the projection matrix
    modelMatrix.setTranslate(0, 0, 0);  // No Translation
    // Pass the model matrix to the uniform variable
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Draw x and y axes
    gl.uniform4fv(u_Color, [0.5, 0.5, 0.5, 0]);
    gl.drawArrays(gl.LINES, 0, n);

    gl.uniform1i(u_isLighting, true); // Will apply lighting

    // Set the vertex coordinates and color (for the cube)
    n = initVertexBuffers(gl);
    if (n < 0) {
        console.log('Failed to set the vertex information');
        return;
    }
    drawInfo.n = n;

    // Draw walls and floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0, 14);  // Translation to the 'middle' of the room
    drawClassroomSides(drawInfo, 40, 40, 18);
    modelMatrix = popMatrix();

    // Draw 3 rows of chairs/tables
    for (var i = 0; i < 3; i++) {
        drawRow(drawInfo, 9, 0, i * 8);
        drawRow(drawInfo, -9, 0, i * 8);
    }

    // Draw desk at front
    drawFrontDesk(drawInfo, 10.5, 0, 26.5);

    // Draw door
    drawDoor(drawInfo, -18, 0, 33);

    // End timer and update
    updateFPS(performance.now() - startTime);

    // Make it so that draw is called again when needed
    window.requestAnimationFrame(draw);
}

function drawDoor(drawInfo, x, y, z) {
    var depth = 1;
    var width = 5;
    var height = 12;

    // Door colour - brown
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.396, 0.263, 0.129, 1]);

    // Rotation/translation
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);
    modelMatrix.rotate(-doorAngle, 0, 1, 0);

    // Door piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(depth / -2, height / 2, width / -2);
    modelMatrix.scale(depth, height, width); // Scale
    drawBox(drawInfo);

    // Handle
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.573, 0.502, 0.137, 1]);
    modelMatrix = popMatrix();
    modelMatrix.translate(depth / -2, height / 2, - (width - 1));
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

function drawClassroomSides(drawInfo, width, depth, height) {
    // Set the colour to white
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [1, 1, 1, 1]);

    // Save the matrix in the middle of the floor
    pushMatrix(modelMatrix);

    // Model the floor
    modelMatrix.translate(0, -0.5, 0);
    modelMatrix.scale(width, 1, depth); // Scale
    drawBox(drawInfo);

    // Model the back wall
    modelMatrix = topMatrix();
    modelMatrix.translate(0, height / 2, (depth / -2) + 0.5);
    modelMatrix.scale(width, height, 1); // Scale
    drawBox(drawInfo);
    // Model the front wall
    modelMatrix.translate(0, 0, depth - 1);
    drawBox(drawInfo);

    // Model the side wall without windows
    modelMatrix = topMatrix();
    modelMatrix.translate((width / -2) + 0.5, height / 2, 0);
    modelMatrix.scale(1, height, depth);
    drawBox(drawInfo);

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
    var dividerWidth = (depth - (windowWidth * 2)) / 3;
    var dividerTranslate = (depth / 2) - (dividerWidth / 2);

    // Create the three diviers iteratively
    for (var i = -1; i <= 1; i++) {
        modelMatrix = topMatrix();
        modelMatrix.translate(0, height / 2, i * dividerTranslate);
        modelMatrix.scale(1, height, dividerWidth);
        drawBox(drawInfo);
    }

    var windowHeight = height - (heightFromFloor + heightFromTop);
    var windowCentreWidth = (dividerWidth + windowWidth) / 2;
    var windowCentreHeight = heightFromFloor + (windowHeight / 2);

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

    var borderThickness = 0.2;

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
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.788, 0.867, 1, 0.1]);
    modelMatrix = topMatrix();
    modelMatrix.scale(0.4, height, width);
    drawBox(drawInfo);

    modelMatrix = popMatrix();
}

function drawRow(drawInfo, x, y, z) {
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);  // Translation

    drawChair(drawInfo, -4.5, 0, 0);
    drawChair(drawInfo, -1.5, 0, 0);
    drawChair(drawInfo, 1.5, 0, 0);
    drawChair(drawInfo, 4.5, 0, 0);

    drawTable(drawInfo, -3.05, 0, 3);
    drawTable(drawInfo, 3.05, 0, 3);

    modelMatrix = popMatrix();
}

function drawTable(drawInfo, x, y, z, width, colour) {
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
    pushMatrix(modelMatrix);
    modelMatrix.scale(width, 0.3, 3.0); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.3, 0.3, 0.3, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    var legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];
    var widthOffset = (width / 2) - 0.25;

    for (var i = 0; i < legOffsets.length; i += 2) {
        pushMatrix(modelMatrix);
        modelMatrix.translate(widthOffset * legOffsets[i], -1.7, 1.25 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 3.1, 0.4); // Scale
        drawBox(drawInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawChair(drawInfo, x, y, z, colour) {
    // Default values
    if (!colour) {
        colour = [0.137, 0.576, 0.278, 1]; // Green colour
    }

    // Set the seat colour to green
    drawInfo.gl.uniform4fv(drawInfo.u_Color, colour);

    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y + 2.15, z);  // Translation

    // Model the chair seat
    pushMatrix(modelMatrix);
    modelMatrix.scale(2.0, 0.3, 2.0); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();

    // Model the chair back
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 1.65, -0.85);  // Translation
    modelMatrix.scale(2.0, 3.0, 0.3); // Scale
    drawBox(drawInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawInfo.gl.uniform4fv(drawInfo.u_Color, [0.5, 0.5, 0.5, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    var legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];

    for (var i = 0; i < legOffsets.length; i += 2)
    {
        pushMatrix(modelMatrix);
        modelMatrix.translate(0.8 * legOffsets[i], -1.15, 0.8 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 2.0, 0.4); // Scale
        drawBox(drawInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawBox(drawInfo) {
    var gl = drawInfo.gl;
    var u_ModelMatrix = drawInfo.u_ModelMatrix;
    var u_NormalMatrix = drawInfo.u_NormalMatrix;
    var num_vertices = drawInfo.n;

    // Pass the model matrix to the uniform variable
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix.setInverseOf(modelMatrix);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

    // Draw the cube
    gl.drawElements(gl.TRIANGLES, num_vertices, gl.UNSIGNED_BYTE, 0);
}

function updateFPS(renderTime) {
    frameTimes[nextFrame] = renderTime;
    nextFrame++;

    // Reset and update
    if (nextFrame >= frameTimes.length) {
        nextFrame = 0;

        var totTime = sumArray(frameTimes);
        var frameTime = totTime / frameTimes.length;

        frameTimeLabel.innerText = "Avg. Frame Time: " + frameTime.toFixed(2) + "ms";
    }
}

function sumArray(array) {
    var sum = 0;
    for (var i = 0; i < array.length; i++) {
        sum += array[i];
    }

    return sum;
}

function degToRad(degree) {
    return degree * (Math.PI / 180);
}

function loadLocalFile(filename) {
    // Synchronously load a local file and return it as text
    // https://stackoverflow.com/questions/247483/http-get-request-in-javascript
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", filename, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}