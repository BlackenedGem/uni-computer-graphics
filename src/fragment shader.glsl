#ifdef GL_ES
precision mediump float;
#endif

// Colour of the box
uniform vec4 u_Color;

// Enable/disable lighting
uniform bool u_isLighting;

// Lighting information
uniform vec3 u_AmbientColor;// Global light colour
uniform vec3 u_LightColor;
const int numLights = 4;
uniform vec3 u_LightSources[numLights]; // Info of individual lightsource. Either position or direction (x, y, z)
uniform vec2 u_LightIntensity[numLights]; // Intensity of light. For spot light contains drop off factor
uniform bool u_LightType[numLights]; // Whether light source is spot or directional
uniform bool u_LightEnabled[numLights]; // Whether light source is enabled or not

uniform bool u_ExtraAmbient; // Whether the object is a light source so should have additional light

// Varyings
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
    // Disable lighting if flag set
    if (!u_isLighting) {
        gl_FragColor = u_Color;
        return;
    }

    vec3 diffuse;

    for (int i = 0; i < numLights; i++) {
        // Only include lights that are turned on
        if (!u_LightEnabled[i]) {
            continue;
        }

        float lightIntensity = u_LightIntensity[i].x;

        vec3 lightDirection;
        if (u_LightType[i]) {
            vec3 lightPosition = vec3(u_LightSources[i]);
            lightDirection = normalize(u_LightSources[i] - v_Position);

            // Get the light distance and divide it by the dropoff
            float lightDistance = length(u_LightSources[i] - v_Position) / u_LightIntensity[i].y;
            lightIntensity /= pow(1.0 + lightDistance, 2.0); // Use an inverse square law

            // Calculate the light direction and make it 1.0 in length
            // Dot product of light direction and normal
            float nDotL = max(dot(lightDirection, v_Normal), 0.0);
            diffuse += u_LightColor * u_Color.rgb * nDotL * lightIntensity;
        } else {
            lightDirection = u_LightSources[i];

            float nDotL = max(dot(lightDirection, v_Normal), 0.0);
            diffuse += nDotL * u_LightColor * lightIntensity;
        }
    }

    // Toggle if the light is an actual light source
    vec3 ambient;
    if (u_ExtraAmbient) {
        ambient = 0.4 * u_Color.rgb;
        diffuse *= 0.8;
    } else {
        ambient = 0.05 * u_Color.rgb;
    }

    gl_FragColor = vec4(diffuse + ambient, u_Color.a);
}