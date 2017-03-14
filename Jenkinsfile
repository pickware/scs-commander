node {
	stage('Checkout') {
		deleteDir()
		checkout scm
	}

	stage('Docker Build') {
		docker.withRegistry('https://docker.viison.com:5000', '049e4a92-92d3-4bb2-9c8d-e3411d2a9981') {
			docker.build('docker.viison.com:5000/scs-commander').push()
		}
	}

	def node = docker.image('node')
	node.inside() {
		stage('Build') {
			sh 'npm install'
		}
		stage('ESLint') {
			sh 'npm run eslint'
		}
	}
}
