window.Project = window.classes.Project =
class Project extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   ) 
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,0,10 ), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) );
        context.globals.graphics_state.camera_transform = context.globals.graphics_state.camera_transform.times(Mat4.translation([0, 0, 8]));

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );
        const shapes = { box:   new Cube(),
                         axis:  new Axis_Arrows(),
                         sphere: new Subdivision_Sphere(4),
                         rocket: new Shape_From_File( "/assets/rocket.obj" ),
                         gunner: new Cube()
                       }

        this.submit_shapes( context, shapes );

        // Earth is the texture for the planet, Universe is the background texture, Bump_map is the bumped version of the rocket, and 
        // Non_bump is the version of the rocket without it.
        this.materials =
          { phong: context.get_instance( Phong_Shader ).material( Color.of( 1,1,0,1 ) ),
            white: context.get_instance(Phong_Shader).material(Color.of(1,1,1,1)),
            earth: context.get_instance(Phong_Shader).material(Color.of(0,0,0,1), {ambient: 1, texture: context.get_instance("assets/earth.jpg", true)}),
            universe: context.get_instance(Texture_Scroll_X).material(Color.of(0,0,0,1), {ambient: 1, texture: context.get_instance("assets/stars.png", true)}),
            bump_map: context.get_instance( Fake_Bump_Map ).material( Color.of( 1,1,1,1 ),        // Bump mapped:
                { ambient: .3, diffusivity: .5, specularity: .5, texture: context.get_instance( "/assets/rocket_texture.jpg" ) } ),
            non_bump: context.get_instance( Phong_Shader )  .material( Color.of( .5,.5,.5,1 ),       // Non bump mapped:
                { ambient: .3, diffusivity: .5, specularity: .5, texture: context.get_instance( "/assets/rocket_texture.jpg" ) } )
          }

        this.lights = [ new Light( Vec.of( -5,5,5,1 ), Color.of( 0,1,1,1 ), 100000 ) ];

        this.playing = false;
        this.start_time = 0.0;
        this.game_over = false;
        this.last_spawn_time = -10.0;
        this.score_label = document.getElementById("score");

        // Set dimensions for Earth
        this.earth_radius = 1;
        this.planet_radius = 0.2;
        this.bullet_radius = 0.08;
        this.gunner_size = 0.1;

        // Set dimensions for Universe Box
        this.universe_width = 50;

        // Set dimensions for Rocket Box
        this.rocket_girth = 0.1;


        this.bullet_transforms = [];
        this.planet_transforms = [];
        this.earth_transform = Mat4.identity().times(Mat4.scale([this.earth_radius, this.earth_radius, this.earth_radius]))
                                              .times(Mat4.rotation(-0.25, Vec.of(0,1,0)));
        this.gunner_transform = Mat4.identity().times(Mat4.rotation(0.1, Vec.of(0,0,1)))
                                               .times(Mat4.translation([this.earth_radius+0.14,0,0]))
                                               .times(Mat4.scale([this.gunner_size, this.gunner_size/2, this.gunner_size]))


        var mainCanvas = document.getElementById('main-canvas');
        mainCanvas.addEventListener("mousemove", this.track.bind(this));
        mainCanvas.addEventListener("mousedown", this.shootCoords.bind(this));
        this.mouseX = 0;
        this.mouseY = 0;

        this.universe_transform = Mat4.identity().times( Mat4.scale([this.universe_width, this.universe_width, this.universe_width]) );
      }

    track(event){
        var rect = document.getElementById("main-canvas").getBoundingClientRect();
        this.mouseX = event.clientX - 548; // need to divide by 100 to get webGL coordinates
        this.mouseY = (event.clientY - 308) * -1; // need to divide by 100 to get webGL coordinates
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

    // Adds bullet to the shot
    add_bullet(targetX, targetY) {
        let rot_angle = (Math.atan2(targetX, targetY) - Math.PI/2.);
        let transform = Mat4.identity().times(Mat4.rotation(rot_angle, Vec.of(0,0,1)))
                                       .times(Mat4.translation([this.earth_radius+0.1,0,0]))
                                       .times(Mat4.scale([this.bullet_radius, this.bullet_radius, this.bullet_radius]));
        console.log("Adding bullet at angle " + rot_angle);
        this.bullet_transforms.push(transform);
    }

    // Creates planets
    spawn_planets(t) {
        if (t - this.last_spawn_time > 5.0) {
            //console.log("SPAWN");
            this.last_spawn_time = t;
            let num_spawn = Math.round((t/8)**2)+4;
            for (let i = 0; i < num_spawn; i++) {
                this.add_planet(Math.random(), Math.random(), 15, Math.random()*Math.PI*2, (Math.random()*0.3)+0.15, t, Math.random() < 0.5 ? -1 : 1);
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

    // Determines where to shoot
    shootCoords(event) {
        if (!this.playing) {
            return;
        }
        let targetX = (this.mouseX);
        let targetY = (this.mouseY);
        console.log("Shooting to " + targetX + ", " + targetY);
        if (!this.game_over)
            this.add_bullet(targetX, targetY);
    }

    track(event){
        let rect = document.getElementById("main-canvas").getBoundingClientRect();
        [this.mouseX, this.mouseY] = this.pixelToGl(event.clientX, event.clientY); // need to divide by 60 to get webGL coordinates
        let rot_angle = (Math.atan2(this.mouseX, this.mouseY) - Math.PI/2.);
        this.gunner_transform = Mat4.identity().times(Mat4.rotation(rot_angle, Vec.of(0,0,1)))
                                               .times(Mat4.translation([this.earth_radius+0.14,0,0]))
                                               .times(Mat4.scale([this.gunner_size, this.gunner_size/2, this.gunner_size]))   
    }

    pixelToGl(x, y) {
        return [(x-548)/60, (y-308)/60];
    }

    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        let t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;
        if (this.playing) {
            t = t - this.start_time;
        } else if (first_start) {
            this.playing = true;
            this.start_time = t;
            t = 0
            dt = 0;
        } else {
            t = 0;
            dt = 0;
        }
       
        // Draw Earth
        this.earth_transform = this.earth_transform.times(Mat4.rotation(dt/2., Vec.of(0,1,0)));

        if (this.game_over) {
            this.earth_transform = this.earth_transform.times(Mat4.scale([0.8, 0.8, 0.8]));
        }

        this.shapes.sphere.draw(graphics_state, this.earth_transform, this.materials.earth);

        // Draw gunner
        if (!this.game_over)
            this.shapes.gunner.draw(graphics_state, this.gunner_transform, this.materials.white);

        // Draw the universe box
        this.shapes.box.draw(graphics_state, this.universe_transform, this.materials.universe);

        this.rocket_transform = Mat4.identity().times(Mat4.rotation(-0.1, Vec.of(1,0,0)));

        if (t > 3.) {
            this.rocket_transform = this.rocket_transform.times(Mat4.rotation(3./2., Vec.of(0,1,0)));
        } 
        else {
            this.rocket_transform = this.rocket_transform.times(Mat4.rotation(t/2., Vec.of(0,1,0)));
        }
        
        this.rocket_transform = this.rocket_transform
                                               .times(Mat4.translation([0,0,this.earth_radius + this.rocket_girth + t/2]))
                                               .times(Mat4.rotation(-Math.PI/2, Vec.of(0,1,0)))
                                               .times(Mat4.scale([this.rocket_girth, this.rocket_girth, this.rocket_girth]))
                                               .times(Mat4.rotation(Math.PI/2, Vec.of(1,0,0)))
                                               .times(Mat4.rotation(-t/2, Vec.of(1,0,0)));
                                                     
        this.shapes.rocket.draw(graphics_state, this.rocket_transform, this.materials.bump_map);

        if (this.playing && t <= 10) {
            graphics_state.camera_transform = graphics_state.camera_transform.times(Mat4.translation([0, 0, -0.02]));
        }

        if (!this.playing) {
            return;
        }

        // Spawn planets
        if (!this.game_over) {
            this.score_label.innerHTML = t.toFixed(2);
            this.spawn_planets(t);
        }

        // Draw all planets and bullets
        for (let p = 0; p < this.planet_transforms.length; p++) {
            let planet = this.planet_transforms[p];
            this.shapes.sphere.draw(graphics_state, planet.transform, this.materials.phong);
            // Update planet
            let next_ptransform = Mat4.identity();
            next_ptransform = next_ptransform.times(Mat4.rotation(planet.init_rot+planet.dir*planet.rot*(t-planet.init_time), Vec.of(0,0,1)))
                                             .times(Mat4.translation([0, planet.init_height-planet.lin*(t-planet.init_time), 0]))
                                             .times(Mat4.scale([planet.scale, planet.scale, planet.scale]));
            this.planet_transforms[p].transform = next_ptransform;
        }
        for (let b = 0; b < this.bullet_transforms.length; b++) {
            let bullet = this.bullet_transforms[b];
            this.shapes.sphere.draw(graphics_state, bullet, this.materials.phong);
            // Update bullet
            this.bullet_transforms[b] = bullet.times(Mat4.translation([1.1,0,0]));
        }

        let bullets_to_remove = [];
        let planets_to_remove = [];
        let p_transforms = this.planet_transforms.slice();
        let b_transforms = this.bullet_transforms.slice();

        // Delete bullets that are off screen
        for (let b = 0; b < b_transforms.length; b++) {
            let bullet = b_transforms[b];

            let bullet_coords = Vec.of(bullet[0][3], bullet[1][3], bullet[2][3]);
            let dist_to_center = Math.sqrt((bullet_coords[0])**2 + (bullet_coords[1])**2 + (bullet_coords[2])**2);

            if (dist_to_center > 15.) {
                // Delete bullet
                delete b_transforms[b];
            }
        } 

        // Detect collisions and remove accordingly
        for (let p = 0; p < p_transforms.length; p++) {
            let planet = p_transforms[p];
            if (planet == undefined) {
                continue;
            }

            // Check for collision to Earth or origin
            let planet_coords = Vec.of(planet.transform[0][3], planet.transform[1][3], planet.transform[2][3]);
            let earth_dist = Math.sqrt((planet_coords[0])**2 + (planet_coords[1])**2 + (planet_coords[2])**2);
            let earth_radius_sum = planet.scale + this.earth_radius;

            if (this.game_over) {
                if (earth_dist < 0.1) {
                    delete p_transforms[p];
                }
            }
            else if (earth_dist < earth_radius_sum) {
                // Collision to earth has occured
                console.log("GAME OVER");
                this.game_over = true;
                source1.stop(0);
                delete p_transforms[p];

                // Show overlay game over text
                this.remove_class('game-over', 'hidden');
                
                continue;
            }

            // Check for collision to bullets
            let collision = false;
            for (let b = 0; b < b_transforms.length; b++) {
                let bullet = b_transforms[b];
                if (bullet == undefined) {
                    continue;
                }

                let bullet_coords = Vec.of(bullet[0][3], bullet[1][3], bullet[2][3]);
                let dist = Math.sqrt((bullet_coords[0]-planet_coords[0])**2 + (bullet_coords[1]-planet_coords[1])**2 + (bullet_coords[2]-planet_coords[2])**2);
                let radius_sum = planet.scale + this.bullet_radius;

                if (dist < radius_sum) {
                    // Collision occured
                    collision = true;
                    // Delete bullet
                    delete b_transforms[b];
                    break;
                }
            } 
            if (collision) {
                // Collision occured
                delete p_transforms[p];
            }
        }

        // Filter out empty bullets and planets
        this.planet_transforms = p_transforms.filter((v) => typeof v !== 'undefined');
        this.bullet_transforms = b_transforms.filter((v) => typeof v !== 'undefined');
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
          vec4 tex_color = texture2D( texture, f_tex_coord + vec2(mod(animation_time,100.)*0.01,0.) );                         // Sample the texture image in the correct place.
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