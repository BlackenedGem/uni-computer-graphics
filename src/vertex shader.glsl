 attribute vec4 a_Position;
 attribute vec4 a_Normal;        // Normal
 uniform mat4 u_ModelMatrix;
 uniform mat4 u_NormalMatrix;
 uniform mat4 u_ViewMatrix;
 uniform mat4 u_ProjMatrix;
 uniform vec3 u_LightColor;     // Light color
 uniform vec3 u_LightDirection; // Light direction (in the world coordinate, normalized)
 uniform vec4 u_Color; // Color of vertex
 varying vec4 v_Color;
 uniform bool u_isLighting;

 void main() {
   gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
   if(u_isLighting)
   {
      vec3 normal = normalize((u_NormalMatrix * a_Normal).xyz);
      float nDotL = max(dot(normal, u_LightDirection), 0.0);
        // Calculate the color due to diffuse reflection
      vec3 diffuse = u_LightColor * u_Color.rgb * nDotL;
      v_Color = vec4(diffuse, u_Color.a);   }
   else
   {
      v_Color = u_Color;
   }
 }