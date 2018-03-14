#ifdef GL_ES
precision mediump float;
#endif

// Colour of the box
uniform vec4 u_Color;

// Enable/disable lighting
uniform bool u_isLighting;

// Lighting information
uniform vec3 u_LightColor; // Global light colour
const int numLights = 4;
uniform vec3 u_LightSources[numLights]; // Info of individual lightsource. Either position or direction (x, y, z)
uniform vec2 u_LightIntensity[numLights]; // Intensity of light. For spot light contains drop off factor
uniform bool u_LightType[numLights]; // Whether light source is spot or directional
uniform bool u_LightEnabled[numLights]; // Whether light source is enabled or not

uniform bool u_ExtraAmbient;

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

        float lightStrength = u_LightIntensity[i].x;

        vec3 lightDirection;
        if (u_LightType[i]) {
            vec3 lightPosition = vec3(u_LightSources[i]);
            lightDirection = normalize(u_LightSources[i] - v_Position);

            // Get the light distance
            float lightDistance = length(u_LightSources[i] - v_Position) / u_LightIntensity[i].x;
            lightDistance = min(1.0, 1.0 / pow(lightDistance, 2.0)); // Use an inverse square law

            // Calculate the light direction and make it 1.0 in length
            // Dot product of light direction and normal
            float nDotL = max(dot(lightDirection, v_Normal), 0.0);
            spotLightIntensity += nDotL * lightDistance;
        } else {
            lightDirection = u_LightSources[i];
        }
    }

    vec3 diffuse = u_LightColor * u_Color.rgb * spotLightIntensity;

    // Toggle if the light is an actual light source
    vec3 ambient;
    if (u_ExtraAmbient) {
        ambient = 0.6 * u_Color.rgb;
        diffuse *= 0.5;
    } else {
        ambient = 0.05 * u_Color.rgb;
    }


    gl_FragColor = vec4(diffuse + ambient, u_Color.a);
}