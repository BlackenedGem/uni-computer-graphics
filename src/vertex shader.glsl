 attribute vec4 a_Position;
 attribute vec4 a_Normal;        // Normal
 uniform mat4 u_ModelMatrix;
 uniform mat4 u_NormalMatrix;
 uniform mat4 u_ViewMatrix;
 uniform mat4 u_ProjMatrix;
 uniform vec3 u_LightColor;     // Light color
 uniform vec3 u_LightPosition;
 uniform vec4 u_Color; // Color of vertex
 varying vec4 v_Color;
 uniform bool u_isLighting;

 void main() {
   vec4 vertexPosition = u_ModelMatrix * a_Position;
   gl_Position = u_ProjMatrix * u_ViewMatrix * vertexPosition;
   if(u_isLighting)
   {
      vec3 lightDirection = normalize(u_LightPosition - vec3(vertexPosition));
      vec3 normal = normalize((u_NormalMatrix * a_Normal).xyz);
      float nDotL = max(dot(lightDirection, normal), 0.0);

      float lightDistance = length(u_LightPosition - vec3(vertexPosition)) / 15.0;
      lightDistance = min(1.0, 1.0 / pow(lightDistance, 2.0)); // Use an inverse square law

        // Calculate the color due to diffuse reflection
      vec3 diffuse = u_LightColor * u_Color.rgb * nDotL * lightDistance;
      v_Color = vec4(diffuse, u_Color.a);   }
   else
   {
      v_Color = u_Color;
   }
 }