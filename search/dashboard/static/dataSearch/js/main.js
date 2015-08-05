// main.js
var _updateSearchResult;
var init = null;
var updateFavoriteQueries = null;

$(function(){
	///////////////////////////////////////////////////////////////////////////////
	//// States
	var		 tabIndex             = 0;
	var      selectedStreams      = [];
	var      metricBadgeValue     = 0;
	var      startDateTime        = null;
	var      endDateTime          = null;
	var      boundsStart          = null;
	var      boundsEnd            = null;
	
	var      MAX_ENTRIES_PER_PAGE = 20;
	var      VISIBLE_PAGES        = 5;
	var      maxPages             = 0;
	var      currentPage          = 0;
	var      searchType           = "basic";
	var      g_initialUpdate      = false;
	
	///////////////////////////////////////////////////////////////////////////////
	//// Methods
	
	function streamName( s )
	{
		var title = s.metric;
		return title
	}

	function selectTab( index ) 
	{
		if ( index == 0 ) {
	    	$("#tab1").addClass( "active" );
	    	$("#tab2").removeClass( "active" );
	    	$("#tab3").removeClass( "active" );

	    	$("#searchPage").show();
	    	$("#metricsPage").hide();
	    	$("#chartPage").hide();

	    	//
	    	initSearchPage();
		}
		else if ( index == 1 ) {
	    	$("#tab1").removeClass( "active" );
	    	$("#tab2").addClass( "active" );
	    	$("#tab3").removeClass( "active" );

	    	$("#searchPage").hide();
	    	$("#metricsPage").show();
	    	$("#chartPage").hide();

	    	//
	    	metricBadgeValue = 0;
	    	updateMetricBadgeValue();
	    	updateSelectedMetrics();
		}
		else {
	    	$("#tab1").removeClass( "active" );
	    	$("#tab2").removeClass( "active" );
	    	$("#tab3").addClass( "active" );

	    	$("#searchPage").hide();
	    	$("#metricsPage").hide();
	    	$("#chartPage").show();

	    	//
	    	updateChart();
	    	
			// 슬라이더 컨트롤 버그 픽스
			$(".dateRangeSlider").dateRangeSlider( "resize" );
		}

		tabIndex = index;
	}
	
	function initSearchPage()
	{
		updateSearchResult();		
	}

	function searchButtonFired()
	{
		var text = $("#searchText").val().trim();
		search( text );
		updateSearchResult()
	}
	
	function streamShouldBeMatchedByKeyword( stream, keyword )
	{
		keyword = keyword.toLowerCase();
		if ( keyword.length > 0 ) {
			// 메트릭 명에 걸리는가?
			if ( stream.metric.toLowerCase().indexOf( keyword ) >= 0 ) {
				return true;
			}
			// 건물명에 걸리는가?
			if ( stream.buildingName ) {
				if ( stream.buildingName.toLowerCase().indexOf( keyword ) >= 0 ) {
					return true;
				}
			}
			// 키워드 중에 걸리는가?
			for( var i = 0; i < stream.keywords.length; ++i ) {
				if ( stream.keywords[i].toLowerCase().indexOf( keyword ) >= 0 ) {
					return true;
				}
			}
		}		
		return false;
	}

	function keywordsFromInputText( text )
	{
		// 
		if ( text[0] == "=" ) {
			var res = [];
			text = text.substring( 1, text.length );
			try {
				res = eval( text );
				if ( res instanceof Array ) {
					for( var i = 0; i < res.length; ++i ) {
						res[i] = res[i].trim();
					}
					return res;
				}
			}
			catch (err) {
				console.log( err.message );
			}
			return [];
		}
		else {
			//
			var arr = text.split( " " );
			for( var i = 0; i < arr.length; ++i ) {
				var s = arr[i];
				s = s.trim();
				
				
				arr[i] = s;
			}
			return arr;
		}
	}	

	function search( text )
	{
		keywords = keywordsFromInputText( text );
		
		if ( searchType == "basic" ) {
			matchedStreams = [];
			
			var i, j, s, k;
			// 들어가야 하는 키워드 목록
			inKeys = []
			exKeys = []

			for( i = 0; i < keywords.length; ++i ) {
				s = keywords[i];
				if ( s[0] == "~" ) {
					if ( s.length > 1 ) {
						s = s.substring( 1, s.length ); // ~ 제외
						exKeys.push( s );
					}
				}
				else { 
					inKeys.push( s );
				}
			}
			
			// 스트림 별로, 키워드 몇개와 매칭되는지 구한다.		
			for( i = 0; i < streams.length; ++i ) {
			 	var score = 0;
			 	s = streams[i];
			 	var flag = false;
			 	
			 	// 배제되어야 하는 키워드가 하나라도 있는가?
			 	for( j = 0; j < exKeys.length; ++j ) {
				 	k = exKeys[j];
				 	if ( streamShouldBeMatchedByKeyword( s, k ) ) {
						flag = true;
						break;	 	
				 	}
			 	}
			 	
			 	if ( !flag ) {
				 	// 포함되어야 하는 키워드가 모두 있는가?
				 	for ( j = 0; j < inKeys.length; ++j ) {
				 		if ( streamShouldBeMatchedByKeyword( s, inKeys[j] ) ) {
				 			score += 1;
				 		} else {
				 			break;
				 		}			
				 	}
				 	// 모든 키워드를 만족하는 스트림만 추가한다.
				 	if ( score == inKeys.length ) {
				 		matchedStreams.push( s );
				 	}
			 	}
			 }
		}
		else if ( searchType == "or" ) {
			matchedStreams = [];
			
			// 스트림 별로, 키워드 몇개와 매칭되는지 구한다.		
			for( var i = 0; i < streams.length; ++i ) {
			 	var score = 0;
			 	var s = streams[i];
			 	
			 	for ( var k = 0; k < keywords.length; ++k ) {
			 		if ( streamShouldBeMatchedByKeyword( s, keywords[k] ) ) {
			 			score += 1;
			 		}			
			 	}
			 	// 하나라도 키워드를 만족하는 스트림을 추가한다.
			 	if ( score > 0 ) {
			 		s._score = score
			 		matchedStreams.push( s );
			 	}
			 }
			 
		 	// 스코어 별로 소팅한다.
		 	for( var i = 0; i < matchedStreams.length-1; ++i ) {
			 	for( var j = i+1; j < matchedStreams.length; ++j ) {
				 	var s1 = matchedStreams[i];
				 	var s2 = matchedStreams[j];
				 	if ( s1._score < s2._score ) {
					 	matchedStreams[i] = s2;
					 	matchedStreams[j] = s1;
				 	}
			 	}
		 	}
		}
		else {
			matchedStreams = streams.slice();
			for ( var i = 0; i < keywords.length; ++i ) {
				var f = new Fuse( matchedStreams, {
					'keys' : [ 'metric', 'buildingName', 'keywords' ]
				});
				matchedStreams = f.search( keywords[i] );
			}
		}
		
		// 페이지 수를 계산함.		
		maxPages    = Math.floor( ( matchedStreams.length + MAX_ENTRIES_PER_PAGE -1 ) / MAX_ENTRIES_PER_PAGE );
		currentPage = 0;
		updatePageNavigator();
	}
	
	function pageNavigatorClicked( page )
	{
		currentPage = page;
		updatePageNavigator();
		updateSearchResult();
	}

	function prevPageClicked()
	{
		var nextPage = currentPage - 10;
		if ( nextPage < 0 ) {
			nextPage = 0;
		}
		
		pageNavigatorClicked( nextPage );
	}

	function nextPageClicked()
	{
		var nextPage = currentPage + 10;
		if ( nextPage >= maxPages ) {
			nextPage = maxPages - 1;
		}
		
		pageNavigatorClicked( nextPage );
	}

	function updatePageNavigator()
	{
		if ( maxPages == 0 ) {
			$("#pageNavigator").hide();
			
		}
		else {
			var startPage = currentPage - 2;
			if ( startPage < 0 ) {
				startPage = 0;
			}
			
			var endPage = startPage + 5;
			if ( endPage > maxPages ) {
				endPage = maxPages;
			}
			
			var pageNav = $( "#pageNavigator" );
			pageNav.empty();
			
			var html = '<li id="prevPage"><a>&laquo;</a></li>';
			for ( var i = startPage; i < endPage; ++i ) {
				var anchorID = "page" + i;
				html += '<li><a id=' + anchorID  + ' data-page=' + i + '>' + ( i + 1 ) + '</a></li>';
			}
			html += '<li id="nextPage"><a>&raquo;</a></li></ul>';
			
			pageNav.html( html );
			// 페이지 인디케이터
			for ( var i = startPage; i < endPage; ++i ) {
				var anchorID = "page" + i;
				$("#" + anchorID).click( function() {
					var page = $(this).data( "page" );
					pageNavigatorClicked( page );
				});
				
				if ( i == currentPage ) {
					$("#" + anchorID).parent().addClass( "active" );
				}
			}
			
			$("#prevPage").click( prevPageClicked );
			if ( startPage == 0 ) {
				$("#prevPage").addClass( "disabled" );
			}
			$("#nextPage").click( nextPageClicked );
			if ( endPage == maxPages ) {
				$("#nextPage").addClass( "disabled" );
			}
			
			//
			$("#pageNavigator").show();
		}
	}
	
	function updateSearchResult()
	{
		if ( matchedStreams.length == 0 ) {
			$("#searchResultCount").html( "검색결과가 없습니다.");
			$("#searchResultContainer").html( "" );
		}
		else {
			$("#searchResultCount").html( "총 " + matchedStreams.length + " 건이 검색되었습니다." + "&nbsp;&nbsp;<a id='moreAnchor1'>more...</a>" );
			$("#searchResultContainer").html( "" );

			txt = '<div id="moreBox1" class="panel panel-default"><div class="panel-heading">ToolBox</div><div class="panel-body">'  + 
		      	       '<button type="button" id="selectAllStreamsInPage" class="btn btn-default">Select all streams in current page</button>'  +
		      	       '<span class="help-block">현재 페이지의 모든 스트림을 추가합니다.</span>' +
		      	       '<button type="button" id="unselectAllStreamsInPage" class="btn btn-default">Unselect all streams in current page</button>'  +
		      	       '<span class="help-block">현재 페이지의 모든 스트림을 (선택 되어 있다면) 선택 해제합니다.</span>' +
				  '</div></div>';
			
			// 화면에 표시해야 하는 인덱스를 구한다.
			var startIndex = currentPage * MAX_ENTRIES_PER_PAGE;
			var endIndex   = startIndex + MAX_ENTRIES_PER_PAGE;
			if ( endIndex > matchedStreams.length ) {
				endIndex = matchedStreams.length;
			}
			
			// 화면에 추가한다.
			for ( var i = startIndex; i < endIndex; ++i ) {
				var stream = matchedStreams[i];
				var moreID = 'more' + i;
				var buttonID = "addButton" + i;
				var moreButtonID = "moreButton" + i;
				var keywordText = "";
				for ( var j = 0; j < stream.keywords.length; ++j ) {
					keywordText += '<span class="label label-info">' + stream.keywords[j] + '</span>';
 					if ( j > 0 && j % 10 == 0 ) {
						keywordText += "<br/>";
					}
					else {
						keywordText += "&nbsp;";
					}
				}
				
				var moreFlag = ( stream.keywords.length > 0 || stream.buildingName || stream.image );
				
				txt += '<a class="list-group-item">' +
					       '<dl class="dl-horizontal">' +
						   '<dt>Metric</dt>' +
						   '<dd>' + stream.metric + '</dd>';

				if ( moreFlag ) {
					txt += '<div id="' + moreID + '" class="collapse">';
				
					if ( stream.keywords.length > 0 ) {
						txt += '<dt>Keywords</dt><dd class="keywords">' + keywordText + '</dd>';
					}
								
					if ( stream.buildingName ) {
						txt += '<dt>Building</dt><dd>' + stream.buildingName  + '</dd>';
						
					}
					if ( stream.image ) {
						var imageDivID = "imageDiv_" + stream.index;

						txt += '<dt>Image</dt><dd>'                                 +
							   '<div id="' + imageDivID + '" class="image-wrapper">'                      +
						       '<img class="image" src="' + stream.image + '"/>'                 +
							   '<img class="image-marker" src="/static/dataSearch/images/marker.png"/>' + 
							   '</div>'                                             +
							   '</dd>';
					}

					txt += '</div>';
				}
				
				txt += '</dl>';
				
				txt += '<div class="row">' +
				       '<div class="btn-group btn-group-sm col-md-offset-10">' +
				       '<button id="' + buttonID + '" data-index=' + i + ' type="button" class="btn btn-default"><span class="glyphicon glyphicon-plus"></span> Add</button>';
				
				txt += '<button id="' + moreButtonID + '" type="button" class="btn btn-default" data-toggle="collapse" href="#' + moreID + '"><span class="glyphicon glyphicon-eye-open"></span> More</button>';
				
				txt += '</div></div></a>';
			}
			
			$("#searchResultContainer").html( txt );
			
			// more anchor 에 이벤트 핸들러 추가함
			$("#moreBox1").hide();
			$("#moreAnchor1").click(function(){
				if ($("#moreBox1").is(':visible')) {
					$("#moreBox1").hide( 100 );
					$("#moreAnchor1").html("more...");
				}
				else {
					$("#moreBox1").show( 100 );
					$("#moreAnchor1").html("hide...");
				}
			});
			$("#selectAllStreamsInPage").click(function(){
				if ( matchedStreams ) {
					// 현재 페이지에 표시되어 있는 스트림들의 인덱스를 구한다.
					var startIndex = currentPage * MAX_ENTRIES_PER_PAGE;
					var endIndex   = startIndex + MAX_ENTRIES_PER_PAGE;
					if ( endIndex > matchedStreams.length ) {
						endIndex = matchedStreams.length;
					}
					// 화면에 추가한다.
					for ( var i = startIndex; i < endIndex; ++i ) {
						var stream = matchedStreams[i];
						selectStream( stream );
					}
					// 화면내의 버튼들을 갱신한다.
					updateSearchResult();
				}

			});
			$("#unselectAllStreamsInPage").click(function(){
				if ( matchedStreams ) {
					// 현재 페이지에 표시되어 있는 스트림들의 인덱스를 구한다.
					var startIndex = currentPage * MAX_ENTRIES_PER_PAGE;
					var endIndex   = startIndex + MAX_ENTRIES_PER_PAGE;
					if ( endIndex > matchedStreams.length ) {
						endIndex = matchedStreams.length;
					}
					// 화면에 추가한다.
					for ( var i = startIndex; i < endIndex; ++i ) {
						var stream = matchedStreams[i];
						unselectStream( stream );
					}
					// 화면내의 버튼들을 갱신한다.
					updateSearchResult();
				}

			});

			// add button 에 이벤트 핸들러 추가함.
			for( var i = startIndex; i < endIndex; ++i ) {
				var stream = matchedStreams[i];
				var buttonID = "addButton" + i;
				var moreButtonID = "moreButton" + i;
				var moreFlag = ( stream.keywords.length > 0 || stream.buildingName || stream.image );
				
				// more 버튼을 disable 할 것인가?
				if ( !moreFlag ) {
					$( "#" + moreButtonID ).addClass( "disabled" );
				}
				// 이미 추가되어 있다면 disable
				if ( selectedStreams.indexOf( stream ) >= 0 ) {
					$( "#" + buttonID ).prop( "disabled", true );
				}
				else {
					$( "#" + buttonID ).click( function( ev ){
						var itemIndex = $(this).data( 'index' );
						// 검색 아이템을 하나 추가한다.
						selectStream( matchedStreams[ itemIndex ] );
						// 자신을 disable 시킨다.
						$(this).prop( "disabled", true );
					});
				}
				
				// more 버튼에 대한 핸들러 추가
				if ( stream.image ) {
					(function( stream, i ){
				
						var moreButtonID = "moreButton" + i;
						$("#"+moreButtonID).click(function(){
							var imageDivID = "imageDiv_" + stream.index;
							var id1 = "#" + imageDivID + " .image";
							var id2 = "#" + imageDivID + " .image-marker";
							
							setTimeout(function(){
								var img = $(id1)[0];
								var w = img.width;
								var h = img.height;
								
								var ratio = $(id1).width() / w;
								var hh    = Math.floor( h * ratio );
								
								$( id2 ).css({
									position : "absolute",
									top      : hh * stream.coordY - 32,
									left     : $( id1 ).width()  * stream.coordX - 10
								});
							}, 100);
						});
					
					})( stream, i );
				}
			}
		}
	}
	
	function updateAddressBar() // 주소창의 주소를 수정한다.
	{
		if ( ! g_initialUpdate ) {
			// 스트림 추가
			q = "?streams=";
			for( var i = 0; i < selectedStreams.length; ++i ) {
				if ( i == selectedStreams.length-1 ) {
					q += selectedStreams[i].streamID;
				}
				else {
					q += selectedStreams[i].streamID + ",";
				}
			}
			
			// 검색 구간 추가
			if ( startDateTime && endDateTime ) {
				q += "&start=" + formatDate( startDateTime ) + "&end=" + formatDate( endDateTime );
			}
			
			// 전체 구간 추가
			if ( boundsStart && boundsEnd ) {
				q += "&boundsStart=" + formatDate( boundsStart ) + "&boundsEnd=" + formatDate( boundsEnd );
			}
			
			window.history.pushState( 
				{
					selectedStreams : selectedStreams,
					startDateTime   : startDateTime,
					endDateTime     : endDateTime,
					boundsStart     : boundsStart,
					boundsEnd       : boundsEnd,
					url             : window.location.href
				}, "MEG DataHub", q );
		}
	}
	
	function selectStream( stream )
	{
		if ( selectedStreams.indexOf( stream ) < 0 ) {
			selectedStreams.push( stream );
			metricBadgeValue += 1;
			updateMetricBadgeValue();
			
			updateAddressBar();
			
			//
			var text = $("#searchText").val().trim();
			if ( window.FlurryAgent ) {
				FlurryAgent.logEvent( "addStream", {
					"stream"     : streamName( stream ),
					"searchTerm" : text
				});
			}
		}
	}
	
	function unselectStreamByIndex( index )
	{
		selectedStreams.splice( index, 1 );
		updateAddressBar();
	}
	
	function unselectStream( stream )
	{
		var index = selectedStreams.indexOf( stream );
		if ( index >= 0 ) {
			unselectStreamByIndex( index );
		}
	}
	
	function unselectAllStreams()
	{
		selectedStreams = []
		updateAddressBar();
		updateSelectedMetrics();
	}
	
	function updateMetricBadgeValue()
	{
		if ( metricBadgeValue == 0 ) {
			$("#metricBadge").hide();
		}
		else {
			$("#metricBadge").html( "" + metricBadgeValue );
			$("#metricBadge").show();
		}
	}
	
	function updateSelectedMetrics()
	{
		if ( selectedStreams.length == 0 ) {
			$("#selectedMetricsCount").html( "선택된 스트림이 없습니다.");
			$("#selectedMetricsContainer").html( "" );
		}
		else {
			$("#selectedMetricsCount").html( "총 " + selectedStreams.length + " 건을 선택하였습니다." + "&nbsp;&nbsp;<a id='moreAnchor2'>more...</a>" );
			$("#selectedMetricsContainer").html( "" );

			txt = '<div id="moreBox2" class="panel panel-default"><div class="panel-heading">ToolBox</div><div class="panel-body">'  + 
		      	       '<div class="input-group"><span class="input-group-btn"><button id="addFavoriteQuery" class="btn btn-default">Add to favorite queries</button></span><input id="favoriteQueryName" type="text" class="form-control" placeholder="Query\'s name"></div>' +
		      	       '<span class="help-block">현재의 검색 결과를 즐겨찾기에 등록합니다(Advance 메뉴에 등록됨).</span>' +
		      	       '<button type="button" id="unselectAllButton" class="btn btn-default">Unselect all streams</button>'  +
		      	       '<span class="help-block">모든 스트림을 선택 해제합니다(Back 버튼을 누르면 복구).</span>' +
				  '</div></div>';
			
			for ( var i = 0; i < selectedStreams.length; ++i ) {
				var stream = selectedStreams[i];
				var buttonID = "removeButton" + i;
				var keywordText = "";
				for ( var j = 0; j < stream.keywords.length; ++j ) {
					keywordText += '<span class="label label-info">' + stream.keywords[j] + '</span>';
					if ( j > 0 && j % 10 == 0 ) {
						keywordText += "<br/>";
					}
					else {
						keywordText += "&nbsp;";
					}
				}
				
				txt += '<a class="list-group-item">' +
						   '<button id="' + buttonID + '" data-index="' + i + '" type="button" class="close" aria-hidden="true">&times;</button>' +
					       '<dl class="dl-horizontal">' +
						   '<dt>Metric</dt>' +
						   '<dd>' + stream.metric + '</dd>' +
						   '<dt>Keywords</dt>' +
						   '<dd class="keywords">' + keywordText + '</dd>';

				if ( stream.buildingName ) {
					txt += '<dt>Building</dt><dd>' + stream.buildingName  + '</dd>';
				}						   

				if ( stream.image ) {
					var imageDivID = "imageDiv2_" + stream.index;
					txt += '<dt>Image</dt><dd>'                                 +
						   '<div id="' + imageDivID + '" class="image-wrapper">'                      +
						   '<img class="image" src="' + stream.image + '"/>'                 +
						   '<img class="image-marker" src="/static/dataSearch/images/marker.png"/>' + 
						   '</div>'                                             +
						   '</dd>';
				}
					
				txt += '</dl></a>';
			}
			
			$("#selectedMetricsContainer").html( txt );
			
			// more anchor 에 이벤트 핸들러 추가함
			$("#moreBox2").hide();
			$("#moreAnchor2").click(function(){
				if ($("#moreBox2").is(':visible')) {
					$("#moreBox2").hide( 100 );
					$("#moreAnchor2").html("more...");
				}
				else {
					$("#moreBox2").show( 100 );
					$("#moreAnchor2").html("hide...");
				}
			});
			$("#unselectAllButton").click(function(){
				unselectAllStreams();
			});
			
			// favorite query 버튼
			$("#addFavoriteQuery").click(function(){
				var name  = $("#favoriteQueryName").val().trim();
				if ( !name ) {
					alert( "쿼리명을 입력하세요.");
					$("#favoriteQueryName").val("");
					$("#favoriteQueryName").focus();
					return;
				}
				var query = "/datahub/dashboard/addFavoriteQuery/?name=" + name + "&url=" + window.location.href;
				
				$.ajax({
					url: query,
					dataType: "json",
					success: function( ret ) {
						console.log( ret );////
						var queryID = ret[1];
						addFavoriteQuery( queryID, name, window.location.href );
						alert( "Favorite query 등록에 성공하였습니다." );
					},
					error: function( ajaxContext ) {
						alert( "Favorite query 등록에 실패하였습니다.\n(에러: " + ajaxContext.responseText + ")" );
					}
				});				
			});
			
			// remove button 에 이벤트 핸들러 추가함.
			for( var i = 0; i < selectedStreams.length; ++i ) {
				var buttonID = "removeButton" + i;
				$( "#" + buttonID ).click( function( ev ){
					var itemIndex = $(this).data( 'index' );
					// 검색 아이템을 삭제 추가한다.
					unselectStreamByIndex( itemIndex );
					
					// 목록을 다시 그린다.
					updateSelectedMetrics();
				});
				
				// more 버튼에 대한 핸들러 추가
				var stream = selectedStreams[i];
				if ( stream.image ) {
					var imageDivID = "imageDiv2_" + stream.index;
					var id1 = "#" + imageDivID + " .image";
					var id2 = "#" + imageDivID + " .image-marker";
					$( id2 ).css( {
						top      : $( id1 ).height() * stream.coordY - 32,
						left     : $( id1 ).width()  * stream.coordX - 10
					});
				}
			}
		}
	}

	function formatDate( t )
	{
		function fmt(m) {
			return (m<=9 ? '0' + m : m);
		}
		return t.getFullYear() + "/" + fmt( t.getMonth()+1 ) + "/" + fmt( t.getDate() ) + "-" + fmt( t.getHours() ) + ":" + fmt( t.getMinutes() ) + ":" + fmt( t.getSeconds() );
	}
	
	function dateTimePickerChanged()
	{
		boundsStart = new Date( $("#startDateTimePicker").data( "DateTimePicker").date.valueOf() );
		boundsEnd   = new Date( $("#endDateTimePicker").data( "DateTimePicker").date.valueOf()   );
		
		startDateTime = boundsStart;
		endDateTime   = boundsEnd;
		
		$(".dateRangeSlider" ).dateRangeSlider( "bounds", startDateTime, endDateTime );
		$(".dateRangeSlider" ).dateRangeSlider( "values", startDateTime, endDateTime );
		
		if ( startDateTime.getFullYear() != endDateTime.getFullYear() ) {
			$(".dateRangeSlider" ).dateRangeSlider( { step:{ hours:6 } } );
		}
		else if ( startDateTime.getMonth() != endDateTime.getMonth() ) {
			$(".dateRangeSlider" ).dateRangeSlider( { step:{ hours:1 } } );
		}
		else if ( startDateTime.getDate() != endDateTime.getDate() ) {
			$(".dateRangeSlider" ).dateRangeSlider( { step:{ minutes:10 } } );
		}
		else {
			$(".dateRangeSlider" ).dateRangeSlider( { step:{ seconds:10 } } );
		}
	
		updateAddressBar();
		updateChart();
	}
	
	function dateSliderChanged()
	{
		startDateTime = $(".dateRangeSlider" ).dateRangeSlider( "min" );
		endDateTime   = $(".dateRangeSlider" ).dateRangeSlider( "max" );

		updateAddressBar();
		updateChart();
	}
	
	function queryForSeries(startDateTime, endDateTime, streams, aggregator)
	{
		var query = "/datahub/dashboard/series/?start=" + formatDate(startDateTime) + "&end=" + formatDate(endDateTime);

		// metric names
		var metrics = ''
		for( var i = 0; i < streams.length; ++i ) {
			var s = streams[i];
			metrics += s.metric;
			if (i < streams.length - 1) {
				metrics += ',';
			}
		}
		query += '&m=' + metrics;

		// aggregator
		if (aggregator) {
			query += '&agg=' + aggregator;
		}
		return query;
	}	
	
	function stringToDateTime( q ) // yyyy/mm/dd-HH:MM:SS
	{
		var arr = q.split("-");
		var arr2 = arr[0].split( "/" );
		var arr3 = arr[1].split( ":" );
		
		var yyyy = parseInt( arr2[0] );
		var mm   = parseInt( arr2[1] ) - 1; 
		var dd   = parseInt( arr2[2] );
		var HH   = parseInt( arr3[0] );
		var MM   = parseInt( arr3[1] );
		var DD   = parseInt( arr3[2] );
		
		return new Date( yyyy, mm, dd, HH, MM, DD );
	}
	
	function updateChart()
	{
		$("#chart").empty();
		
		// 검색 기간 설정 (자동)
		var autoFlag = false;
		if ( null == endDateTime ) {
			// URL 파라미터로 있는가?
			// 슬라이더 종료 구간 
			var q = $.url().param( "end" );
			if ( q ) {
				endDateTime = stringToDateTime(q);
			}
			else {
				endDateTime = new Date();
			}
			
			// 검색 종료 구간
			q = $.url().param( "boundsEnd" );
			if ( q ) {
				boundsEnd = stringToDateTime( q );
			}
			else {
				boundsEnd = endDateTime;
			}
			
			//
			$("#endDateTimePicker").data( "DateTimePicker" ).setDate( boundsEnd );
			
			autoFlag = true;
		}
		if ( null == startDateTime ) {
			// URL 파라미터로 있는가?
			// 슬라이더 시작 구간
			var q = $.url().param( "start" );
			if ( q ) {
				startDateTime = stringToDateTime(q);
			}
			else {
				startDateTime = new Date( endDateTime );
				startDateTime.setDate( endDateTime.getDate()-7 );
			}
			
			// 검색 시작 구간
			q = $.url().param( "boundsStart" );
			if ( q ) {
				boundsStart = stringToDateTime( q );
			}
			else {
				boundsStart = startDateTime;
			}
			
			//
			$("#startDateTimePicker").data( "DateTimePicker" ).setDate( boundsStart );
			
			autoFlag = true;
		}
		if ( autoFlag ) {// 슬라이더 컨트롤도 조정한다.
			setTimeout(function(){
				$(".dateRangeSlider").dateRangeSlider( "bounds", boundsStart, boundsEnd );
				$(".dateRangeSlider").dateRangeSlider( "values", startDateTime, endDateTime );
			},100);
		}
		
		// 챠트 이미지를 생성한다.
		if ( selectedStreams.length > 0 ) {
			
			// 유틸 함수를 정의
			function addChartPanel( title, name, streams, closeButtonHandler ) {
				var collapseName = name + "Collapse";
				var imageName    = name + "Image";
				var loadingName  = name + "Loading";
				var bodyName     = name + "Body";
				var anchorName   = name + "Anchor";
				var saveButtonName = name + "SaveButton";
				var closeButtonName = name + "CloseButton";
							
				var html = '<div class="panel panel-default">' + 
				              '<div class="panel-heading">'    +
	                             '<h4 class="panel-title">'    + 
	                                '<a id="' + anchorName + '" data-toggle="collapse" data-parent="#chart" href="#' + collapseName + '">' +
	                                    title + 
									'</a>';
									
									if ( closeButtonHandler ) {
										html += '<button id="' + closeButtonName + '" type="button" class="close" style="position:relative;top:-3px;">&times;</button>';
									}
									
				html +=          '</h4>' +
							  '</div>' +
							  '<div id="' + collapseName + '" class="panel-collapse collapse">' +
	  						     '<div id="' + bodyName + '" class="panel-body">' + 
	  						     	// 일단은 로딩을 보여준다.
	  							 	'<div id="' + loadingName + '" class="progress progress-striped active">' +
	  							 	'<div class="progress-bar" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width: 100%"></div></div>' +
	  						     
	  							 '</div>' +
	  						  '</div>' +
	  						'</div>';
	  
	  			$("#chart").append( html );
	  
				var div = $('<div id="' + imageName + '">');
				div.appendTo( '#' + bodyName );
				addChartToDiv(imageName, startDateTime, endDateTime, streams, function(){
					// 로딩바를 가린다.
					$("#" + loadingName).hide();
				});
				
				//
				$("#" + bodyName).append( '<button id="' + saveButtonName + '" type="button" class="btn btn-primary">Save</button>' );
				$("#" + saveButtonName ).tooltip( {
					title : "IE, Chrome 등 일부 브라우저에서 사용 가능합니다."
				});
				$("#" + saveButtonName ).click( function() {
					saveStreams( "result.csv", startDateTime, endDateTime, streams );
				});
				if ( closeButtonHandler ) {
					$("#" + closeButtonName).click(closeButtonHandler);
				}
			};
			
			// 메트릭 삭제 버튼 핸들러 팩토리
			function onCloseButtonHandlerForStream( stream ) {
				return function() {
					unselectStream( stream );
					updateChart();
				};
			}
			
			// 메트릭 갯수에 따라 달리 처리한다.
			if ( selectedStreams.length > 1 ) {
				// 모든 메트릭이 함께 나오는 패널을 추가한다.
				addChartPanel( "전체", "chartAll", selectedStreams, null );
				
				// 각 메트릭이 나오는 패널을 추가한다.
				for( var i = 0; i < selectedStreams.length; ++i ) {
					var s = selectedStreams[i];
					var title = streamName( s );
					addChartPanel( title, "chart-" + i, [ s ], onCloseButtonHandlerForStream( s ) );
				}
				
				// 1초 후에 전체를 열어준다.
				if ( !autoFlag ) {
					setTimeout( function(){
						$( "#chartAllAnchor" ).trigger( "click" );
					}, 1000 );
				}
			}	
			else {
				var s = selectedStreams[0];
				var title = streamName( s );

				// 모든 메트릭이 함께 나오는 패널을 추가한다.
				addChartPanel( title, "chartAll", [s], onCloseButtonHandlerForStream( s ) );
				
				// 1초 후에 전체를 열어준다.
				if ( !autoFlag ) {
					setTimeout( function(){
						$( "#chartAllAnchor" ).trigger( "click" );
					}, 1000 );
				}
			}
	
		}
		else {
			var text = $( "<p class='text-muted'>선택된 스트림이 없습니다.</p>" );
			text.appendTo( "#chart" );
		}
	}

	function addChartToDiv(divID, startDateTime, endDateTime, streams, callback)
	{
		var group_by = ((endDateTime.getTime() - startDateTime.getTime()) / 1000.0) / 100.0;
		var query = queryForSeries(startDateTime, endDateTime, streams, aggregator='mean-'+group_by + 's');
		$.ajax({
			url: query,
			dataType: "json",
			success: function(series) {
				var data = [];
				for(var series_name in series) {
					if (series.hasOwnProperty(series_name)) {
						arr = [];
						pairs = series[series_name];
						for ( var i = 0; i < pairs.length; ++i ) {
							var t = pairs[i][0];
							var v = pairs[i][1];
							arr.push([t * 1000, v])
						}
						data.push({
							label: series_name,
							data: arr
						});
					}
				}

				//
				var options = {
					colors: ['#7fb36d', '#eab838', '#6ed0e0', '#ef843c', '#e24d42'],
					shadowSize: 0.0,
					grid: {
						show: true,
						borderWidth: 0.0,
					},
					legend: {
						show: true,
					},
					xaxis: {
						mode: 'time',
						timezone: 'browser',
					},
					yaxis: {
						tickFormatter: function(value, axis) {
							return value;
						}
					},
					series: {
						stack: false,
						lines: {
							show: true,
							lineWidth: 0.5,
							fill: 0,
							stack: false,
						},
					}
				};
				options.xaxis.max = endDateTime.getTime();
				options.xaxis.min = startDateTime.getTime();
				$('#' + divID).width(800);
				$('#' + divID).height(250);
				$.plot($('#' + divID), data, options);
				callback();
			},
			error: function(ajaxContext) {
				console.log(ajaxContext);
				alert("데이터 수신에 실패하였습니다.\n(에러: " + ajaxContext.responseText + ")");
			}
		});
	}

	function saveStreams(title, startDateTime, endDateTime, streams)
	{
		var query = queryForSeries(startDateTime, endDateTime, streams);
		alert( "TSD 로 ascii 데이터를 요청합니다.\n(쿼리: " + query + ")" );
		$.ajax({
			url: query,
			dataType: "json",
			success: function(series) {
				var text = "";

				for(var series_name in series) {
					if (series.hasOwnProperty(series_name)) {
						pairs = series[series_name];
						for ( var i = 0; i < pairs.length; ++i ) {
							var t = pairs[i][0];
							var v = pairs[i][1];
							text += series_name + ',' + t + ',' + v + '\n';
						}
					}
				}

				//
				console.log(text);//

				//
				var blob = new Blob([text], {type:"text/plain;charset=utf-8"});
				saveAs(blob, title);
				alert("저장되었습니다.\n(파일명: " + title + ")");
			},
			error: function( ajaxContext ) {
				console.log( ajaxContext );
				alert("데이터 수신에 실패하였습니다.\n(에러: " + ajaxContext.responseText + ")");
			}
		});

		// Save 액션에 대한 로깅
		var text = "";		
		for( var i = 0; i < streams.length; ++i ) {
			text += streamName( streams[i] );
			if ( i < streams.length - 1 ) {
				text += ',';
			}
		}
		
		if ( window.FlurryAgent ) {
			FlurryAgent.logEvent( "saveStreams", {
				"streams"    : text,
				"searchTerm" : $("#searchText").val().trim()
			});
		}
	}
	
	function streamByID( streamID )
	{
		for( var i = 0; i < streams.length; ++i ) {
			if ( streams[i].streamID == streamID ) {
				return streams[i];
			}
		}
		return null;
	}
	
	
	function selectInitialStreams()
	{
		// 스트림들을 선택한다.
		var q = $.url().param( "streams" );
		if ( q ) {
			g_initialUpdate = true;
		
			var arr = q.split(",")
			for( var i = 0; i < arr.length; ++i ) {
				var streamID = arr[i].trim();
				var s = streamByID( streamID );
				if ( s ) {
					selectStream( s );
				}
			}
			g_initialUpdate = false;
		}
	}
	
		
	function addFavoriteQuery( queryID, name, url )
	{
		console.log( "queryID:" + queryID + " name:" + name + " url:" + url );///
		favoriteQueries[ queryID ] = { name:name, url:url };
		updateFavoriteQueries();
	}		

	function removeFavoriteQuery( event, queryID, queryName )
	{
		if ( confirm( "Favorite query( \"" + queryName + "\" ) 을 삭제하시겠습니까?" ) ) {
			var query = "/datahub/dashboard/removeFavoriteQuery/?id=" + queryID;

			$.ajax({
				url: query,
				success: function( ret ) {
					delete favoriteQueries[ queryID ];
					updateFavoriteQueries();
					alert( "Favorite query 삭제에 성공하였습니다." );
				},
				error: function( ajaxContext ) {
					alert( "Favorite query 삭제에 실패하였습니다.\n(에러: " + ajaxContext.responseText + ")" );
				}
			});				
		}
		event.preventDefault();
	}

	function _updateFavoriteQueries()
	{
		var html = _advancedDropDownMenuHTML;
		
		var queryIDs = Object.keys( favoriteQueries );
		
		if ( queryIDs.length > 0 ) {
			html += '<li role="presentation" class="divider"></li>' +
			        '<li class="dropdown-header">Favorite queries</li>';
		}
		
		for ( var i = 0; i < queryIDs.length; ++i ) {
			var queryID = queryIDs[ i ];
			var query = favoriteQueries[ queryID ];
			html += '<li role="presentation"><a href="' + query.url + '">' + query.name + 
			        '<button type="button" class="close" onclick="removeFavoriteQuery( event, ' + queryID + ', \'' + query.name + '\' );">&times;</button></a></li>';
		}
		
		$("#advancedDropDownMenu").html( html );
	}
	
	
	///////////////////////////////////////////////////////////////////////////////
	//// Entry points
	function _init()
	{
		for( var i = 0; i < streams.length; ++i ) {
			streams[i].index = i;
		}
	
	
		// 탭을 처리한다.
		$("#tab1 a").click(function(){
	    	selectTab(0);	
		});
		$("#tab2 a").click(function(){
	    	selectTab(1);	
		});
		$("#tab3 a").click(function(){
	    	selectTab(2);	
		});
		selectTab(0);
		
		// 검색 타입
		$("#searchTypeBasic").click(function(){
			searchType = "basic";
			$("#searchTypeName").html("AND");
			$("#searchTypeName").tooltip( null );
			$("#searchText").val( "" );
			searchButtonFired();
		});
		
		$("#searchTypeOR").click(function(){
			searchType = "or";
			$("#searchTypeName").html("OR");
			$("#searchTypeName").tooltip( null );
			$("#searchText").val( "" );
			searchButtonFired();
		});
	
		$("#searchTypeFuzzy").click(function(){
			searchType = "fuzzy";
			$("#searchTypeName").html("Fuzzy");
			$("#searchTypeName").tooltip({
				title : "Experimental"
			});
			$("#searchText").val( "" );
			searchButtonFired();
		});

		// 검색 버튼
		$.fn.enterKey = function (fnc) {
		    return this.each(function () {
		        $(this).keypress(function (ev) {
		            var keycode = (ev.keyCode ? ev.keyCode : ev.which);
		            if (keycode == '13') {
		                fnc.call(this, ev);
		            }
		        })
		    })
		};
		
		$("#searchText").on( 'input', function(){
			if ( searchType == "basic" ) {
				searchButtonFired();
			}
		});
	
		$("#searchText").on( 'keypress', function(e){
			if ( searchType == "fuzzy" ) {
				var code = (e.keyCode ? e.keyCode : e.which);
				if ( code == 13 ) {
					$("#searchResultCount").html( "검색 중 ...");
					setTimeout(function(){
						searchButtonFired();
					},0);
				}
				else {
					$("#searchResultCount").html( "Fuzzy 모드에선, 엔터키를 눌를 때 검색이 진행됩니다.");
					$("#searchResultContainer").html( "" );
					$("#pageNavigator").hide();
				}
			}
			else if ( searchType == "or" ) {
				var code = (e.keyCode ? e.keyCode : e.which);
				if ( code == 13 ) {
					$("#searchResultCount").html( "검색 중 ...");
					setTimeout(function(){
						searchButtonFired();
					},0);
				}
				else {
					$("#searchResultCount").html( "OR 모드에선, 엔터키를 눌를 때 검색이 진행됩니다.");
					$("#searchResultContainer").html( "" );
					$("#pageNavigator").hide();
				}
			}
		}).on( 'keydown', function(e) {
			if ( searchType == "fuzzy" ) {
				var code = (e.keyCode ? e.keyCode : e.which);
				if ( code == 8 ) {
					$("#searchText").trigger( "keypress" );
				}
			}
		});
		
		
		$("#searchTypeBasic").trigger( "click" );
		
		// 날짜 컨트롤 생성
		$("#startDateTimePicker").datetimepicker({
			language: 'ko'
		});
		$("#endDateTimePicker").datetimepicker({
			language: 'ko'
		});
		$("#startDateTimePicker").on( "change.dp", function(e){
			dateTimePickerChanged();
		});
		$("#endDateTimePicker").on( "change.dp", function(e){
			dateTimePickerChanged();
		});
		
		// 슬라이더 생성
		$(".dateRangeSlider").dateRangeSlider({
			step: {
				minutes: 10
			},
			formatter:function( val ) {
				var year    = val.getFullYear();
				var month   = val.getMonth() + 1;
				var days    = val.getDate();
				var hours   = val.getHours();   if ( hours < 10 ) { hours = "0" + hours; }
				var minutes = val.getMinutes(); if ( minutes < 10 ) { minutes = "0" + minutes; }
				var seconds = val.getSeconds(); if ( seconds < 10 ) { seconds = "0" + seconds; }
				return year + "/" + month + "/" + days + "-" + hours + ":" + minutes + ":" + seconds;
			},
			wheelMode: "zoom",
		});
		
		setTimeout(function(){
			$(".dateRangeSlider" ).on( "valuesChanged", function( e, data ) {
				if ( startDateTime && endDateTime ) {
					dateSliderChanged();
				}
			});
		}, 3000);
		
		//
		$(window).bind( 'popstate', function( ev ) {
			var state = ev.originalEvent.state;
			if ( state ) {
				window.location.href = state.url;
			}
		});
		
		// 네비게이션
		if ( categorySource.children.length > 0 ) {
			$( "#categoryMenu" ).fancytree({
				source: categorySource.children,
	  			activate: function( event, data ) {
		  			matchedStreams = data.node.data.streams.slice();
		  			updateSearchResult();
	  			}
			});
			
			$("#categoryMenuAnchor").click(function(){
				if ( $("#categoryMenuContainer").is(":visible") ) {
					$("#categoryMenuContainer").hide( "slide", { direction: "up" }, 100);
					$("#categoryMenuAnchor").html('Show&nbsp;<span class="glyphicon glyphicon-chevron-down"></span>');
				}
				else {
					$("#categoryMenuContainer").show( "slide", { direction: "up" }, 100);
					$("#categoryMenuAnchor").html('Hide&nbsp;<span class="glyphicon glyphicon-chevron-up"></span>');
				}
			});
			
			$("#categoryMenuContainer").show();
			$("#categoryMenuAnchor").html('Show&nbsp;<span class="glyphicon glyphicon-chevron-down"></span>');
		}
		else {
			$("#categoryMenuContainer").hide();
			$("#categoryMenuAnchor").hide();
		}
			
		// Fuzzy Slider
		//$( "#fuzzySlider" ).slider();
		
		$("body").fadeIn(500);
		
		// 파라미터를 파싱, 스트림을 선택한다.
		selectInitialStreams();
		
		//
		_updateSearchResult = updateSearchResult;
	}
	
	init = _init;
	updateFavoriteQueries = _updateFavoriteQueries;
	
});
		
