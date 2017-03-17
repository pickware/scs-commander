node {
	stage('Checkout') {
		deleteDir()
		checkout scm
	}

	def scsCommander = docker.image('docker.viison.com:5000/scs-commander')
    def image = null

	stage('Docker build') {
		docker.withRegistry('https://docker.viison.com:5000', '049e4a92-92d3-4bb2-9c8d-e3411d2a9981') {
			image = docker.build("${scsCommander.imageName()}")
		}
	}

	stage('ESLint') {
	    image.inside {
	        // cd is required here because the user the image is called with does not exist in the container :/
		    sh "cd /usr/src/app && npm run eslint"
	    }
	}

	stage('Docker push') {
	    docker.withRegistry('https://docker.viison.com:5000', '049e4a92-92d3-4bb2-9c8d-e3411d2a9981') {
           image.push()
        }
	}
}
