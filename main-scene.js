window.Project = window.classes.Project =
class Project extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   ) 
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,0,5 ), Vec.of( 0,2,0 ), Vec.of( 0,1,0 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        const shapes = { box:   new Cube(),
                         axis:  new Axis_Arrows(),
                         sphere: new Subdivision_Sphere(4)
                       }

        this.submit_shapes( context, shapes );

        this.materials =
          { phong: context.get_instance( Phong_Shader ).material( Color.of( 1,1,0,1 ) ),
            earth: context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient: 1, texture: context.get_instance("assets/earth.jpg", true)})
          }

        this.lights = [ new Light( Vec.of( -5,5,5,1 ), Color.of( 0,1,1,1 ), 100000 ) ];

        this.earth_radius = 1;
        this.planet_radius = 0.2;
        this.bullet_radius = 0.08;
        this.bullet_transform = Mat4.identity().times(Mat4.scale([this.bullet_radius, this.bullet_radius, this.bullet_radius]));
        this.planet_transform = Mat4.identity().times(Mat4.translation([0,3,0]))
                                               .times(Mat4.scale([this.planet_radius, this.planet_radius, this.planet_radius]));
      }
    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;

        // Draw Earth
        this.shapes.sphere.draw(graphics_state, Mat4.identity(), this.materials.earth);

        // Draw bullets
        this.bullet_transform = this.bullet_transform.times(Mat4.translation([0,5*dt,0]));
        this.shapes.sphere.draw(graphics_state, this.bullet_transform, this.materials.phong);

        // Detect collisions
        let bullet_coords = Vec.of(this.bullet_transform[0][3], this.bullet_transform[1][3], this.bullet_transform[2][3]);
        let planet_coords = Vec.of(this.planet_transform[0][3], this.planet_transform[1][3], this.planet_transform[2][3]);
        let dist = Math.sqrt((bullet_coords[0]-planet_coords[0])**2 + (bullet_coords[1]-planet_coords[1])**2 + (bullet_coords[2]-planet_coords[2])**2);
        let radius_sum = this.planet_radius + this.bullet_radius;

        if (dist >= radius_sum) {
            // Draw planets
            this.shapes.sphere.draw(graphics_state, this.planet_transform, this.materials.phong);
        }
      }
  }

class Texture_Scroll_X extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      // TODO:  Modify the shader below (right now it's just the same fragment shader as Phong_Shader) for requirement #6.
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord + vec2(mod(animation_time,4.)*2.,0.) );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}

class Texture_Rotate extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      // TODO:  Modify the shader below (right now it's just the same fragment shader as Phong_Shader) for requirement #7.
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          
          float pi = 3.14159265359;
          float t = (pi/2.)*mod(animation_time,4.);

          // Translate vector to get center, rotate it, then translate it back to original position
          mat2 rot_mat = mat2(cos(t), sin(t), -1.*sin(t), cos(t));
          vec4 tex_color = texture2D( texture, (rot_mat * (f_tex_coord - vec2(.5,.5))) + vec2(.5,.5) );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}