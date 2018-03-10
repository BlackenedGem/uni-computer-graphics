// Vertex shader program
var VSHADER_SOURCE = loadLocalFile('vertex shader.glsl');

// Fragment shader program
var FSHADER_SOURCE = loadLocalFile('fragment shader.glsl');

var modelMatrix = new Matrix4(); // The model matrix
var viewMatrix = new Matrix4();  // The view matrix
var projMatrix = new Matrix4();  // The projection matrix
var g_normalMatrix = new Matrix4();  // Coordinate transformation matrix for normals

var ANGLE_STEP = 3.0;  // The increments of rotation angle (degrees)
var g_xAngle = 0.0;    // The rotation x angle (degrees)
var g_yAngle = 0.0;    // The rotation y angle (degrees)

function main() {
    // Retrieve <canvas> element
    var canvas = document.getElementById('webgl');

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
    var u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');
    var u_Color = gl.getUniformLocation(gl.program, 'u_Color');

    // Trigger using lighting or not
    var u_isLighting = gl.getUniformLocation(gl.program, 'u_isLighting');

    if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix ||
        !u_ProjMatrix || !u_LightColor || !u_LightDirection ||
        !u_isLighting || !u_Color) {
        console.log('Failed to Get the storage locations of at least one uniform');
        return;
    }

    // Set the light color (white)
    gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0);
    // Set the light direction (in the world coordinate)
    var lightDirection = new Vector3([0.5, 3.0, 4.0]);
    lightDirection.normalize();     // Normalize
    gl.uniform3fv(u_LightDirection, lightDirection.elements);

    // Calculate the view matrix and the projection matrix
    viewMatrix.setLookAt(0, 0, 100, 0, 0, -100, 0, 1, 1);
    projMatrix.setPerspective(30, canvas.width/canvas.height, 1, 150);
    // Pass the model, view, and projection matrix to the uniform variable respectively
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);


    document.onkeydown = function(ev){
        keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
    };

    draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
}

function keydown(ev, gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color) {
    switch (ev.keyCode) {
        case 40: // Up arrow key -> the positive rotation of arm1 around the y-axis
            g_xAngle = (g_xAngle + ANGLE_STEP) % 360;
            break;
        case 38: // Down arrow key -> the negative rotation of arm1 around the y-axis
            g_xAngle = (g_xAngle - ANGLE_STEP) % 360;
            break;
        case 39: // Right arrow key -> the positive rotation of arm1 around the y-axis
            g_yAngle = (g_yAngle + ANGLE_STEP) % 360;
            break;
        case 37: // Left arrow key -> the negative rotation of arm1 around the y-axis
            g_yAngle = (g_yAngle - ANGLE_STEP) % 360;
            break;
        default: return; // Skip drawing at no effective action
    }

    // Draw the scene
    draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color);
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

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_isLighting, u_Color) {
    // Clear color and depth buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

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

    // Reduce parameters when calling drawbox by storing in an object
    var drawBoxInfo = {
        gl: gl,
        u_ModelMatrix: u_ModelMatrix,
        u_NormalMatrix: u_NormalMatrix,
        u_Color: u_Color,
        n: n
    };

    modelMatrix.rotate(g_yAngle, 0, 1, 0); // Rotate along y axis
    modelMatrix.rotate(g_xAngle, 1, 0, 0); // Rotate along x axis

    drawRow(drawBoxInfo, 0, 0, 0);
}

function drawRow(drawBoxInfo, x, y, z) {
    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);  // Translation

    drawChair(drawBoxInfo, -4.5, 0, 0);
    drawChair(drawBoxInfo, -1.5, 0, 0);
    drawChair(drawBoxInfo, 1.5, 0, 0);
    drawChair(drawBoxInfo, 4.5, 0, 0);

    modelMatrix = popMatrix();
}

function drawChair(drawBoxInfo, x, y, z) {
    // Set the seat colour to green
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0, 1, 0, 1]);

    pushMatrix(modelMatrix);
    modelMatrix.translate(x, y, z);  // Translation

    // Model the chair seat
    pushMatrix(modelMatrix);
    modelMatrix.scale(2.0, 0.3, 2.0); // Scale
    drawbox(drawBoxInfo);
    modelMatrix = popMatrix();

    // Model the chair back
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 1.65, -0.85);  // Translation
    modelMatrix.scale(2.0, 3.0, 0.3); // Scale
    drawbox(drawBoxInfo);
    modelMatrix = popMatrix();

    // Set the leg colour to dark grey
    drawBoxInfo.gl.uniform4fv(drawBoxInfo.u_Color, [0.9, 0.9, 0.9, 1]);

    // Model legs
    // Do this in a loop
    // Array is a bunch of x/y multiplicative offsets
    var legOffsets = [1, 1, -1, 1, -1, -1, 1, -1];

    for (var i = 0; i < legOffsets.length; i += 2)
    {
        pushMatrix(modelMatrix);
        modelMatrix.translate(0.8 * legOffsets[i], -1.15, 0.8 * legOffsets[i + 1]);  // Translation
        modelMatrix.scale(0.4, 2.0, 0.4); // Scale
        drawbox(drawBoxInfo);
        modelMatrix = popMatrix();
    }

    modelMatrix = popMatrix();
}

function drawbox(drawBoxInfo) {
    var gl = drawBoxInfo.gl;
    var u_ModelMatrix = drawBoxInfo.u_ModelMatrix;
    var u_NormalMatrix = drawBoxInfo.u_NormalMatrix;
    var num_vertices = drawBoxInfo.n;

    pushMatrix(modelMatrix);

    // Pass the model matrix to the uniform variable
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix.setInverseOf(modelMatrix);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);

    // Draw the cube
    gl.drawElements(gl.TRIANGLES, num_vertices, gl.UNSIGNED_BYTE, 0);

    modelMatrix = popMatrix();
}

function loadLocalFile(filename) {
    // https://stackoverflow.com/questions/247483/http-get-request-in-javascript
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", filename, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}