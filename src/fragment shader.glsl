#ifdef GL_ES
precision mediump float;
#endif

uniform vec3 u_LightColor;     // Light color
uniform vec3 u_LightPosition;
uniform vec4 u_Color; // Color of vertex
uniform bool u_isLighting;

varying vec4 v_Color;
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
    // Calculate the light direction and make it 1.0 in length
    vec3 lightDirection = normalize(u_LightPosition - v_Position);
    // Dot product of light direction and normal
    float nDotL = max(dot(lightDirection, v_Normal), 0.0);

    float lightDistance = length(u_LightPosition - v_Position) / 15.0; // TODO remove magic constant, make configurable
    lightDistance = min(1.0, 1.0 / pow(lightDistance, 2.0)); // Use an inverse square law

    vec3 diffuse = u_LightColor * u_Color.rgb * nDotL * lightDistance;
    gl_FragColor = vec4(diffuse, u_Color.a);
}