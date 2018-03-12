 attribute vec4 a_Position;
 attribute vec4 a_Normal;        // Normal
 uniform mat4 u_ModelMatrix;
 uniform mat4 u_NormalMatrix;
 uniform mat4 u_ViewMatrix;
 uniform mat4 u_ProjMatrix;

 // Varyings
 varying vec3 v_Position;
 varying vec3 v_Normal;

 void main() {
   vec4 vertexPosition = u_ModelMatrix * a_Position;
   v_Position = vec3(vertexPosition);
   v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
   gl_Position = u_ProjMatrix * u_ViewMatrix * vertexPosition;
}