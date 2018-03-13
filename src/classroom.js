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

var frameTimeLabel;

// Variable that keeps track of whether the mouse is down or not
var isMouseDown = false;
document.onmousedown = function() { isMouseDown = true };
document.onmouseup   = function() { isMouseDown = false };

function main() {
    // Retrieve <canvas> element
    var canvas = document.getElementById('webgl');
    camera.aspectRatio = canvas.width/canvas.height;

    // Retrieve frametime
    frameTimeLabel = document.getElementById("frametime");

    // Get the rendering context for WebGL
    var gl = getWebGLContext(canvas);
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
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

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

    document.onkeydown = function(ev){
        keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
    };

    document.onmousemove = function(ev) {
        mouse(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
    };

    draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
}

function mouse(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color) {
    if (!isMouseDown) {
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

    draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
}

function keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color) {
    switch (ev.keyCode) {
        case 87: // W key
            moveCameraForwards(1);
            break;
        case 83: // S key
            moveCameraForwards(-1);
            break;
        case 40: // Up arrow key
            moveCameraUpwards(-1);
            break;
        case 38: // Down arrow key
            moveCameraUpwards(1);
            break;
        case 39: // Right arrow key
            moveCameraSideways(-1);
            break;
        case 37: // Left arrow key
            moveCameraSideways(1);
            break;
        default: return; // Skip drawing at no effective action
    }

    // Draw the scene
    draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
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
    projMatrix.setPerspective(camera.fov, camera.aspectRatio, 0.1, 1000);

    // Pass the model, view, and projection matrix to the uniform variable respectively
    gl.uniformMatrix4fv(camera.u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(camera.u_ProjMatrix, false, projMatrix.elements);
}

function initLightSourceUniforms(gl, u_LightSources, u_LightEnabled) {
    var lightSources = new Float32Array([   // Coordinates
        10.0, 20.0, 5.0, 10.0,
        -10.0, 10.0, 25.0, 10.0
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

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color) {
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

    // Reduce parameters when calling drawBox by storing in an object
    var drawBoxInfo = {
        gl: gl,
        u_ModelMatrix: u_ModelMatrix,
        u_NormalMatrix: u_NormalMatrix,
        u_Color: u_Color,
        n: n
    };

    // Draw walls and floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0, 14);  // Translation to the 'middle' of the room
    drawClassroomSides(drawBoxInfo, 40, 40, 18);
    modelMatrix = popMatrix();

    // Draw 3 rows of chairs/tables
    for (var i = 0; i < 3; i++) {
        drawRow(drawBoxInfo, 9, 0, i * 8);
        drawRow(drawBoxInfo, -9, 0, i * 8);
    }

    // End timer and update
    var renderTime = performance.now() - startTime;
    renderTime = renderTime.toFixed(3);
    frameTimeLabel.innerText = "Frame time: " + renderTime + " ms";
}

function drawClassroomSides(drawBoxInfo, width, depth, height) {
    // Set the colour to white
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [1, 1, 1, 1]);

    // Save the matrix in the middle of the floor
    pushMatrix(modelMatrix);

    // Model the floor
    modelMatrix.translate(0, -0.5, 0);
    modelMatrix.scale(width, 1, depth); // Scale
    drawBox(drawBoxInfo);

    // Model the back wall
    modelMatrix = topMatrix();
    modelMatrix.translate(0, height / 2, (depth / -2) + 0.5);
    modelMatrix.scale(width, height, 1); // Scale
    drawBox(drawBoxInfo);
    // Model the front wall
    modelMatrix.translate(0, 0, depth - 1);
    drawBox(drawBoxInfo);

    // Model the side wall without windows
    modelMatrix = topMatrix();
    modelMatrix.translate((width / -2) + 0.5, height / 2, 0);
    modelMatrix.scale(1, height, depth);
    drawBox(drawBoxInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate((width / 2) - 0.5, 0, 0);
    drawWallWithWindows(drawBoxInfo, depth, height, 15, 5, 2);

    // Return back to origin
    modelMatrix = popMatrix();
}

function drawWallWithWindows(drawBoxInfo, depth, height, windowWidth, heightFromFloor, heightFromTop) {
    pushMatrix(modelMatrix);

    // Top and bottom sections
    modelMatrix.translate(0, heightFromFloor / 2, 0);
    modelMatrix.scale(1, heightFromFloor, depth);
    drawBox(drawBoxInfo);

    modelMatrix = topMatrix();
    modelMatrix.translate(0, height - (heightFromTop / 2), 0);
    modelMatrix.scale(1, heightFromTop, depth);
    drawBox(drawBoxInfo);

    // Dividers
    var dividerWidth = (depth - (windowWidth * 2)) / 3;
    var dividerTranslate = (depth / 2) - (dividerWidth / 2);

    for (var i = -1; i <= 1; i++) {
        modelMatrix = topMatrix();
        modelMatrix.translate(0, height / 2, i * dividerTranslate);
        modelMatrix.scale(1, height, dividerWidth);
        drawBox(drawBoxInfo);
    }

    popMatrix();
}

function drawRow(drawBoxInfo, x, y, z) {
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);  // Translation

    drawChair(drawBoxInfo, -4.5, 0, 0);
    drawChair(drawBoxInfo, -1.5, 0, 0);
    drawChair(drawBoxInfo, 1.5, 0, 0);
    drawChair(drawBoxInfo, 4.5, 0, 0);

    drawTable(drawBoxInfo, -3.05, 0, 3);
    drawTable(drawBoxInfo, 3.05, 0, 3);

    modelMatrix = popMatrix();
}

function drawTable(drawBoxInfo, x, y, z) {
    // Set the table colour to a browny colour
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0.824, 0.706, 0.549, 1]);

    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y + 3.25, z);  // Translation

    // Model the chair seat
    pushMatrix(modelMatrix);
    modelMatrix.scale(6, 0.3, 3.0); // Scale
    drawBox(drawBoxInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0.3, 0.3, 0.3, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    var legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];

    for (var i = 0; i < legOffsets.length; i += 2)
    {
        pushMatrix(modelMatrix);
        modelMatrix.translate(2.75 * legOffsets[i], -1.7, 1.25 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 3.1, 0.4); // Scale
        drawBox(drawBoxInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawChair(drawBoxInfo, x, y, z) {
    // Set the seat colour to green
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0, 1, 0, 1]);

    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y + 2.15, z);  // Translation

    // Model the chair seat
    pushMatrix(modelMatrix);
    modelMatrix.scale(2.0, 0.3, 2.0); // Scale
    drawBox(drawBoxInfo);
    modelMatrix = popMatrix();

    // Model the chair back
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 1.65, -0.85);  // Translation
    modelMatrix.scale(2.0, 3.0, 0.3); // Scale
    drawBox(drawBoxInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0.5, 0.5, 0.5, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    var legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];

    for (var i = 0; i < legOffsets.length; i += 2)
    {
        pushMatrix(modelMatrix);
        modelMatrix.translate(0.8 * legOffsets[i], -1.15, 0.8 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 2.0, 0.4); // Scale
        drawBox(drawBoxInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawBox(drawBoxInfo) {
    var gl = drawBoxInfo.gl;
    var u_ModelMatrix = drawBoxInfo.u_ModelMatrix;
    var u_NormalMatrix = drawBoxInfo.u_NormalMatrix;
    var num_vertices = drawBoxInfo.n;

    // Pass the model matrix to the uniform variable
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix.setInverseOf(modelMatrix);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

    // Draw the cube
    gl.drawElements(gl.TRIANGLES, num_vertices, gl.UNSIGNED_BYTE, 0);
}

function degToRad(degree) {
    return degree * (Math.PI / 180);
}

function loadLocalFile(filename) {
    // https://stackoverflow.com/questions/247483/http-get-request-in-javascript
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", filename, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}