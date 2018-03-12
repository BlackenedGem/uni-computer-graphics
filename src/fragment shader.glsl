#ifdef GL_ES
precision mediump float;
#endif

// Colour of the box
uniform vec4 u_Color;

// Enable/disable lighting
uniform bool u_isLighting;

// Lighting information
uniform vec3 u_LightColor; // Global light colour
const int numLights = 2;
uniform vec4 u_LightSources[numLights]; // Info of individual lightsource (x, y, z, intensity)
uniform bool u_LightEnabled[numLights]; // Whether light source is enabled or not

// Varyings
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
    // Disable lighting if flag set
    if (!u_isLighting) {
        gl_FragColor = u_Color;
        return;
    }

    float spotLightIntensity = 0.0;

    for (int i = 0; i < numLights; i++) {
        // Only include lights that are turned on
        if (!u_LightEnabled[i]) {
            continue;
        }

        vec3 lightPosition = vec3(u_LightSources[i]);

        // Calculate the light direction and make it 1.0 in length
        vec3 lightDirection = normalize(lightPosition - v_Position);
        // Dot product of light direction and normal
        float nDotL = max(dot(lightDirection, v_Normal), 0.0);

        float lightDistance = length(lightPosition - v_Position) / u_LightSources[i].a;
        lightDistance = min(1.0, 1.0 / pow(lightDistance, 2.0)); // Use an inverse square law

        spotLightIntensity += nDotL * lightDistance;
    }

    vec3 diffuse = u_LightColor * u_Color.rgb * spotLightIntensity;
    gl_FragColor = vec4(diffuse, u_Color.a);
}