import {
	StereoCamera,
	Vector2,
    Vector3
} from 'three';

class KStereoEffect {

	constructor( renderer ) {

		const _stereo = new StereoCamera();
		_stereo.aspect = 1;
		const size = new Vector2();

		this.setEyeSeparation = function ( eyeSep ) {
			_stereo.eyeSep = eyeSep;
		};

		this.setSize = function ( width, height ) {
			renderer.setSize( width, height );
		};

        this.setViewScale = function (factor) {
            _stereo.eyeSep = 0.064 * factor;
        }

        this.setCameraFrustum = null;

		this.render = function ( scene, camera ) {

			if ( scene.matrixWorldAutoUpdate === true ) scene.updateMatrixWorld();

			if ( camera.parent === null && camera.matrixWorldAutoUpdate === true ) camera.updateMatrixWorld();

			_stereo.update( camera );
            if (this.setCameraFrustum != null) {
                const _eyeLeft = new Vector3(-_stereo.eyeSep / 2, 0, 0);
                const _eyeRight = new Vector3(_stereo.eyeSep / 2, 0, 0);
                _stereo.cameraL.position.copy(camera.position);
                _stereo.cameraL.position.add(_eyeLeft);
                _stereo.cameraR.position.copy(camera.position);
                _stereo.cameraR.position.add(_eyeRight);
                this.setCameraFrustum(_stereo.cameraL);
                this.setCameraFrustum(_stereo.cameraR);
            }

			renderer.getSize( size );

			if ( renderer.autoClear ) renderer.clear();
			renderer.setScissorTest( true );

			renderer.setScissor( 0, 0, size.width / 2, size.height );
			renderer.setViewport( 0, 0, size.width / 2, size.height );
			renderer.render( scene, _stereo.cameraL );

			renderer.setScissor( size.width / 2, 0, size.width / 2, size.height );
			renderer.setViewport( size.width / 2, 0, size.width / 2, size.height );
			renderer.render( scene, _stereo.cameraR );

			renderer.setScissorTest( false );

		};

	}

}

export { KStereoEffect };