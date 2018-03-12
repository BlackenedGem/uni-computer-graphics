#ifdef GL_ES
precision mediump float;
#endif

// Colour of the box
uniform vec4 u_Color;

// Enable/disable lighting
uniform bool u_isLighting;

// Lighting information
uniform vec3 u_LightColor; // Global light colour
uniform vec4 u_LightSources[2]; // Info of individual lightsource (x, y, z, intensity)
uniform bool u_LightEnabled[2]; // Whether light source is enabled or not

// Varyings
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
    // Disable lighting if flag set
    if (!u_isLighting) {
        gl_FragColor = u_Color;
        return;
    }

    // Calculate the light direction and make it 1.0 in length
    vec3 lightDirection = normalize(u_LightPosition - v_Position);
    // Dot product of light direction and normal
    float nDotL = max(dot(lightDirection, v_Normal), 0.0);

    float lightDistance = length(u_LightPosition - v_Position) / 15.0; // TODO remove magic constant, make configurable
    lightDistance = min(1.0, 1.0 / pow(lightDistance, 2.0)); // Use an inverse square law

    vec3 diffuse = u_LightColor * u_Color.rgb * nDotL * lightDistance;
    gl_FragColor = vec4(diffuse, u_Color.a);
}