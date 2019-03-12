var http = require('http');
var path = require('path');
var express = require('express');
var ejs = require('ejs');
var Web3 = require('web3');
var Tx = require('ethereumjs-tx');
var socketio = require('socket.io');
var indexRouter = require('./routes/index');

var app = express();
var server = http.Server(app);
var login_ids = {}; // 서버 접속 중인 클라이언트 수 체크용 변수
var timer; 

// ejs 템플릿 엔진 사용
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 정적 파일 등록
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'function')));

// 라우터 사용
app.use('/', indexRouter);

server.listen(3000);

var io = socketio(server);
console.log('socket.io 요청을 받아들일 준비가 되었습니다.');

io.on('connect', function(socket) {
	login_ids[socket.id] = socket.id;
	
	console.log(socket.id + "접속");
	console.log('접속한 클라이언트 ID 갯수 : %d', Object.keys(login_ids).length);
	
	var web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/QWMtYHudqUPNKFVZF2nv'));
	var ABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"INITIAL_SUPPLY","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint256"}],"name":"burn","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_value","type":"uint256"}],"name":"burnFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_burner","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
	var contractAddress = "0x4BFBa4a8F28755Cb2061c413459EE562c6B9c51b";
	var contract = web3.eth.contract(ABI).at(contractAddress);
	
	// 잔액 조회 기능
	socket.on('walletAddr', function(walletAddr) {
		try {
			var ethBalance = web3.fromWei(web3.eth.getBalance(walletAddr));
			var omgBalance = contract.balanceOf(walletAddr);
		} catch(e) {
			io.to(socket.id).emit('catch', e.message);
			return false;
		}
		
		var coinBalance = {
			ethBalance : ethBalance.toNumber(),
			omgBalance : omgBalance.toString(10),
		};
		
		io.to(socket.id).emit('coinBalance', coinBalance);
	});
	
	// 토큰 전송 기능(이더리움)
	socket.on('sendCoinETH', function(params) {
		try {
			var nonce 		= web3.eth.getTransactionCount(params.sellWalletAddr); // 보내는사람이 전송한 트랜잭션 수
			var gasPrice 	= web3.eth.gasPrice; // 현재 가스(수수료) 가격 반환
			var value 		= web3.toWei(params.amount, 'ether'); // 해당 금액을 이더에서 Wei로 변환 
			var gasLimit    = web3.eth.estimateGas({ to: params.buyWalletAddr, from: params.sellWalletAddr, value: value }); // from이 to에게 value를 보냈을 때 수수료 얼마 나올지 견적 내줌
			var privateKey  = Buffer.from(params.privateKey, 'hex') // 보안키 - 트랜잭션 서명에 사용
			
			var rawTx = {
				nonce : web3.toHex(nonce),
				gasPrice : web3.toHex(gasPrice),
				gasLimit : web3.toHex(gasLimit),
				to : params.buyWalletAddr,
				from : params.sellWalletAddr,
				value : web3.toHex(value),
				data : '0x',
				chainId : 3
			};
			
			var tx = new Tx(rawTx);
			tx.sign(privateKey);
			var serializedTx = tx.serialize();
			
			web3.eth.sendRawTransaction('0x' + serializedTx.toString('hex'), function(err, hash) {
				if(!err) {
					io.to(socket.id).emit('alert', hash);
					console.log(hash);
				} else {
					io.to(socket.id).emit('alert', err.message);
				}
			});
		} catch(e) {
			io.to(socket.id).emit('catch', e.message);
			return false;
		}
	});
	
	// 토큰 전송 기능(오미세고)
	socket.on('sendCoinOMG', function(params) {
		try {
			var amount 		= web3.toHex(web3.toWei(params.amount, 'ether')); // 해당 금액을 이더에서 Wei로 변환 후 HEX로 변환
			var nonce 		= web3.eth.getTransactionCount(params.sellWalletAddr); // 보내는사람이 전송한 트랜잭션 수
			var gasPrice 	= web3.eth.gasPrice;  // 현재 가스(수수료) 가격 반환
			var value 		= "0x0"; 
			var gasLimit    = web3.eth.estimateGas({ to: params.buyWalletAddr, from: params.sellWalletAddr, value: value }); // from이 to에게 value를 보냈을 때 수수료 얼마 나올지 견적 내줌
			var data        = contract.transfer.getData(params.buyWalletAddr, amount); // transfer(to,value) 내가 가진 토큰 value 개를 to 에게 보내라  
			var privateKey  = Buffer.from(params.privateKey, 'hex'); // 보안키 - 트랜잭션 서명에 사용
			
			var rawTx = {
				nonce : web3.toHex(nonce),
				gasPrice : web3.toHex(2 * 1e9),
				gasLimit : web3.toHex(210000),
				to : contractAddress,
				from : params.sellWalletAddr,
				value : web3.toHex(value),
				data : data,
				chainId : 3
			};
			
			var tx = new Tx(rawTx);
			tx.sign(privateKey);
			var serializedTx = tx.serialize();
			
			web3.eth.sendRawTransaction('0x' + serializedTx.toString('hex'), function(err, hash) {
				if(!err) {
					io.to(socket.id).emit('alert', hash);
					console.log(hash);
					
					clearInterval(timer);
					io.to(socket.id).emit('msg', 'ing');
					timer = setInterval(function() {
						getTransactionReceipt(hash);
					}, 3000);
				} else {
					io.to(socket.id).emit('alert', err.message);
				}
			});
		} catch(e) {
			io.to(socket.id).emit('catch', e.message);
			return false;
		}
	});
	
	// 거래 영수증 확인
	function getTransactionReceipt(hash) {
		try {
			web3.eth.getTransactionReceipt(hash, function(e, r) {
				console.info('getTransactionReceipt');
				console.info(r);
			
				if(r == null) {
					io.to(socket.id).emit('msg', 'ing');
				} else {
					var obj = {
							status : r.status,
							blockNumber : r.blockNumber
					}
				
					io.to(socket.id).emit('msg', obj);
					clearInterval(timer);
				}
			});
		} catch(e) {
			io.to(socket.id).emit('msg', e.message);
			clearInterval(timer);			
			return false;
		}
	}
	
	socket.on('disconnect', function() {
	    console.log(socket.id + "접속 종료");
	    delete login_ids[socket.id];
	    console.log('접속한 클라이언트 ID 갯수 : %d', Object.keys(login_ids).length);
	});
});