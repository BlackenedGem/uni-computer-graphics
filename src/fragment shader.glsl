#ifdef GL_ES
precision mediump float;
#endif

// Colour of the box
uniform vec4 u_Color;

// Enable/disable lighting
uniform bool u_isLighting;

// Texture information
uniform bool u_UseTextures;

// Lighting information
uniform vec3 u_AmbientColor;// Global light colour
uniform float u_Ambient; // Amount of ambient light
uniform float u_DiffuseMult; // Nifty value we can use to make a surface appear brighter than it would be naturally

const int numLights = 5;
uniform vec3 u_LightSources[numLights]; // Info of individual lightsource. Either position or direction (x, y, z)
uniform vec2 u_LightIntensity[numLights]; // Intensity of light. For spot light contains drop off factor
uniform bool u_LightType[numLights]; // Whether light source is spot or directional
uniform bool u_LightEnabled[numLights]; // Whether light source is enabled or not
uniform vec3 u_LightColor[numLights]; // Colour of the light

// Varyings
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
    // Disable lighting if flag set
    if (!u_isLighting) {
        gl_FragColor = u_Color;
        return;
    }

    vec4 pixelColor;
    if (u_UseTextures) {
    } else {
        pixelColor = u_Color;
    }

    vec3 diffuse;

    for (int i = 0; i < numLights; i++) {
        // Only include lights that are turned on
        if (!u_LightEnabled[i]) {
            continue;
        }

        float lightIntensity = u_LightIntensity[i].x;
        vec3 lightColor = u_LightColor[i];

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
            diffuse += lightColor  * pixelColor.rgb * nDotL * lightIntensity;
        } else {
            lightDirection = normalize(u_LightSources[i]);
            float nDotL = max(dot(lightDirection, v_Normal), 0.0);
            diffuse += nDotL * lightColor * pixelColor.rgb * lightIntensity;
        }
    }

    // Toggle if the light is an actual light source
    vec3 ambient = u_Ambient * pixelColor.rgb;

    gl_FragColor = vec4(diffuse * u_DiffuseMult + ambient, pixelColor.a);
}