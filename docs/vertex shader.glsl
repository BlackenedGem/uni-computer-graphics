 attribute vec4 a_Position;
 attribute vec4 a_Normal;        // Normal
 attribute vec2 a_TexCoord; // Texture
 uniform mat4 u_ModelMatrix;
 uniform mat4 u_NormalMatrix;
 uniform mat4 u_ViewMatrix;
 uniform mat4 u_ProjMatrix;

 // Varyings
 varying vec3 v_Position;
 varying vec3 v_Normal;
 varying vec2 v_TexCoord;

 void main() {
   // Vertex position
   vec4 vertexPosition = u_ModelMatrix * a_Position;
   v_Position = vec3(vertexPosition);

   // Normals and texture co-ordinates
   v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
   v_TexCoord = a_TexCoord;

   // Final position on screen
   gl_Position = u_ProjMatrix * u_ViewMatrix * vertexPosition;
}