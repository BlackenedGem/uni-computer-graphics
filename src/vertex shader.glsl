 attribute vec4 a_Position;
 attribute vec4 a_Normal;        // Normal
 attribute vec2 a_TexCoord; // Texture
 uniform mat4 u_ModelMatrix;
 uniform mat4 u_NormalMatrix;
 uniform mat4 u_ViewMatrix;
 uniform mat4 u_ProjMatrix;
 uniform vec4 u_Eye;

 // Varyings
 varying vec3 v_Position;
 varying vec3 v_Normal;
 varying vec2 v_TexCoord;
 varying float v_Distance;

 void main() {
   vec4 vertexPosition = u_ModelMatrix * a_Position;
   v_Position = vec3(vertexPosition);
   v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
   v_TexCoord = a_TexCoord;
   v_Distance = distance(vertexPosition, u_Eye);
   gl_Position = u_ProjMatrix * u_ViewMatrix * vertexPosition;
}