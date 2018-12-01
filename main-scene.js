window.Project = window.classes.Project =
class Project extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   ) 
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,0,10 ), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        const shapes = { box:   new Cube(),
                         axis:  new Axis_Arrows(),
                         sphere: new Subdivision_Sphere(4)
                       }

        this.submit_shapes( context, shapes );

        this.materials =
          { phong: context.get_instance( Phong_Shader ).material( Color.of( 1,1,0,1 ) ),
            earth: context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient: 1, texture: context.get_instance("assets/earth.jpg", true)}),
            universe: context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient: 1, texture: context.get_instance("assets/rsz_universe.jpg", true)})
          }

        this.lights = [ new Light( Vec.of( -5,5,5,1 ), Color.of( 0,1,1,1 ), 100000 ) ];

        this.game_over = false;
        this.last_spawn_time = -10.0;
        this.score_label = document.getElementById("score");

        // Set dimensions for Earth
        this.earth_radius = 1;
        this.planet_radius = 0.2;
        this.bullet_radius = 0.08;

        // Set dimensions for Universe Box
        this.universe_width = 10;


//         this.bullet_transforms = [Mat4.identity().times(Mat4.scale([this.bullet_radius, this.bullet_radius, this.bullet_radius]))];
        this.bullet_transforms = [];
        this.planet_transforms = [];
        this.earth_transform = Mat4.identity().times(Mat4.scale([this.earth_radius, this.earth_radius, this.earth_radius]));

        this.universe_transform = Mat4.identity().times( Mat4.scale([this.universe_width, this.universe_width, this.universe_width]) );
      }

    // rot controls how fast planet orbits around Earth
    // lin controls how fast planet descends towards Earth
    // init_height is initial height of planet above Earth
    // init_rot is initial rotation angle of planet about origin
    // scale is radius of planet
    // init_time is time of planet spawn
    // dir is direction of orbit (0 for clockwise, 1 for counter-clockwise)
    add_planet(rot, lin, init_height, init_rot, scale, init_t, dir) {
        let planet = {
            rot: rot,
            lin: lin,
            scale: scale,
            dir: dir,
            init_time: init_t,
            init_rot: init_rot,
            init_height: init_height,
            transform: Mat4.identity().times(Mat4.rotation(init_rot, Vec.of(0,0,1)))
                                      .times(Mat4.translation([0, init_height, 0]))
                                      .times(Mat4.scale([scale, scale, scale]))
        };

        this.planet_transforms.push(planet);
    }

    spawn_planets(t) {
        if (t - this.last_spawn_time > 5.0) {
            console.log("SPAWN");
            this.last_spawn_time = t;
            let num_spawn = Math.round((t/8)**2)+4;
            for (let i = 0; i < num_spawn; i++) {
                this.add_planet(Math.random(), Math.random(), 10, Math.random()*Math.PI*2, 0.2, t, Math.random() < 0.5 ? -1 : 1);
            }
        }
    }

    remove_class(elem_id, className) {
        let elem = document.getElementById(elem_id);
        if (elem.classList)
          elem.classList.remove(className);
        else
          elem.className = elem.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');   
    }

    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;
        
        //console.log("BULLETS => ");
        //console.log(this.bullet_transforms);

        //console.log("PLANETS => ");
        //console.log(this.planet_transforms);

        
        // Spawn planets
        if (!this.game_over) {
            this.score_label.innerHTML = t.toFixed(2);
            this.spawn_planets(t);
        }

        // Draw the universe box
        
        this.shapes.box.draw(graphics_state, this.universe_transform, this.materials.universe);

        // Draw Earth
        this.earth_transform = this.earth_transform.times(Mat4.rotation(dt/2., Vec.of(0,1,0)));
        this.shapes.sphere.draw(graphics_state, this.earth_transform, this.materials.earth);

        // Detect collisions and draw planets, bullets
        let bullets_to_remove = [];
        let planets_to_remove = [];

        for (let p = 0; p < this.planet_transforms.length; p++) {
            let planet = this.planet_transforms[p];

            // Check for collision to Earth
            let planet_coords = Vec.of(planet.transform[0][3], planet.transform[1][3], planet.transform[2][3]);
            let earth_dist = Math.sqrt((planet_coords[0])**2 + (planet_coords[1])**2 + (planet_coords[2])**2);
            let earth_radius_sum = planet.scale + this.earth_radius;

            if (earth_dist < earth_radius_sum) {
                // Collision to earth has occured
                console.log("GAME OVER");
                this.game_over = true;
                delete this.planet_transforms[p];

                // Show overlay game over text
                this.remove_class('game-over', 'hidden');
                
                continue;
            }

            // Check for collision to bullets
            let collision = false;
            for (let b = 0; b < this.bullet_transforms.length; b++) {
                let bullet = this.bullet_transforms[b];

                let bullet_coords = Vec.of(bullet[0][3], bullet[1][3], bullet[2][3]);
                let dist = Math.sqrt((bullet_coords[0]-planet_coords[0])**2 + (bullet_coords[1]-planet_coords[1])**2 + (bullet_coords[2]-planet_coords[2])**2);
                let radius_sum = planet.scale + this.bullet_radius;

                if (dist < radius_sum) {
                    // Collision occured
                    collision = true;
                    // Delete bullet
                    delete this.bullet_transforms[b];
                    break;
                } else {
                    this.shapes.sphere.draw(graphics_state, bullet, this.materials.phong);
                    // Update bullet
                    this.bullet_transforms[b] = bullet.times(Mat4.translation([0,0.2,0]));
                }
            } 
            if (!collision) {
                this.shapes.sphere.draw(graphics_state, planet.transform, this.materials.phong);
                // Update planet
                let next_ptransform = Mat4.identity();
                next_ptransform = next_ptransform.times(Mat4.rotation(planet.init_rot+planet.dir*planet.rot*(t-planet.init_time), Vec.of(0,0,1)))
                                                 .times(Mat4.translation([0, planet.init_height-planet.lin*(t-planet.init_time), 0]))
                                                 .times(Mat4.scale([planet.scale, planet.scale, planet.scale]));
                this.planet_transforms[p].transform = next_ptransform;
            } else {
                // Collision occured
                delete this.planet_transforms[p];
            }
        }

        // Filter out empty bullets and planets
        this.planet_transforms = this.planet_transforms.filter((v) => typeof v !== 'undefined');
        this.bullet_transforms = this.bullet_transforms.filter((v) => typeof v !== 'undefined');
      }
  }

class Texture_Sphere extends Phong_Shader {
    
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