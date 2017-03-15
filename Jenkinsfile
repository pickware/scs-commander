node {
	stage('Checkout') {
		deleteDir()
		checkout scm
	}

	def scsCommander = docker.image('docker.viison.com:5000/scs-commander')

	stage('Docker Build') {
		docker.withRegistry('https://docker.viison.com:5000', '049e4a92-92d3-4bb2-9c8d-e3411d2a9981') {
			docker.build("${scsCommander.imageName()}").push()
		}
	}

	stage('ESLint') {
		scsCommander.inside() {
			sh 'npm run eslint'
		}
	}
}
