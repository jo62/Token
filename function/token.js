var socket = io();

socket.on('connect', function() {
	$('#balanceOf').click(function() {
		var walletAddr = $.trim($('input[name=walletAddr]').val());
		
		if(walletAddr == "") {
			alert('잔액조회할 지갑주소를 입력해 주세요');
			return false;
		}
		
		socket.emit('walletAddr', walletAddr);
	});
	
	// 잔액 조회 결과
	socket.on('coinBalance', function(balance) {
		$('#ethBalance').text(balance.ethBalance + ' ETH');
		$('#omgBalance').text(balance.omgBalance + ' OMG');
		
		alert("정상적으로 조회가 완료 되었습니다.");
	});
	
	$('#transfer').click(function() {
		var sellWalletAddr = $.trim($('input[name=sellWalletAddr]').val());
		var buyWalletAddr = $.trim($('input[name=buyWalletAddr]').val());
		var privateKey = $.trim($('input[name=privateKey]').val());
		var amount = $.trim($('input[name=amount]').val());
		var coin = $('input[name=coin]:checked').val();
		
		if(sellWalletAddr == "") {
			alert("보내는사람 지갑주소를 입력해 주세요.");
			return false;	
		}
		if(buyWalletAddr == "") {
			alert("받는사람 지갑주소를 입력해 주세요.");
			return false;
		}
		if(privateKey == "") {
			alert("지갑 보안키를 입력해 주세요.");
			return false;
		}
		if(amount == "") {
			alert("전송할 코인 수량을 입력해 주세요.");
			return false;
		}
		if(sellWalletAddr == buyWalletAddr) {
			alert("보내는사람 지갑주소와 받는사람 지갑주소가 동일합니다.");
			return false;
		}
		
		var params = {
			sellWalletAddr : sellWalletAddr,
			buyWalletAddr : buyWalletAddr,
			privateKey : privateKey,
			amount : amount,
			coin : coin
		};
		
		coin=="ETH" ? socket.emit('sendCoinETH', params) : socket.emit('sendCoinOMG', params);
	});
	
	// alert 띄우는 용
	socket.on('alert', function(hash) {
		hash.substring(0, 2) == '0x' ? alert('송금 성공 \n TX : ' + hash) : alert('송금 실패 : ' + err.message);
	});
	
	// catch문 에러메시지
	socket.on('catch', function(err) {
		alert(err);
	})
	
	// 트랜잭션 성공/실패 여부
	socket.on('msg', function(obj) {
		// '0x0'은 트랜잭션 실패를 나타내며 '0x1'은 트랜잭션 성공을 나타냅니다.
		if(obj.status == "0x1") {
			$("#resultMsg").text("성공 [블록넘버:"+obj.blockNumber+"]");
		} else if(obj.status == "0x0") {
			$("#resultMsg").text("실패 [블록넘버:"+obj.blockNumber+"]");
		} else if(obj == "ing") {
			$('#resultMsg').text('전송중.....');
		} else {
			$("#resultMsg").text(obj);
		}
	});
});