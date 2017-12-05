// Example by https://twitter.com/awapblog
// Updated by https://twitter.com/boldbigflank
// Absolutely destroyed by https://twitter.com/Tower_Hufham

//some assets by Twitter, Alamy, WerbeFabrik

var game = new Phaser.Game(800, 600, Phaser.CANVAS, 'phaser-example', { preload: preload, create: create });

var GEM_SIZE = 64;
var GEM_SPACING = 2;
var GEM_SIZE_SPACED = GEM_SIZE + GEM_SPACING;
var BOARD_COLS;
var BOARD_ROWS;
var MATCH_MIN = 3; // min number of same color gems required in a row to be considered a match

var gems;
var selectedGem = null;
var selectedGemStartPos;
var selectedGemTween;
var tempShiftedGem = null;
var allowInput;
var logEmojis = false;
var killedEmojis = [0, 0, 0, 0, 0];
var emojiCounter;
var confusion = false;

function preload() {

    //game.load.spritesheet("GEMS", "assets/sprites/diamonds32x5.png", GEM_SIZE, GEM_SIZE);
    game.load.spritesheet("GEMS", "img/emojis.png", GEM_SIZE, GEM_SIZE);
	game.load.image("POLICE", "img/police.png");
	game.load.image("TEXTBOX", "img/textbox.png");
	game.load.image("DRUGS", "img/drugs.png");
	game.load.image("BLANK", "img/blank.png");

}

function create() {
	
	//game.stage.backgroundColor = "#FCFCFC";
	
    // fill the screen with as many gems as possible
    spawnBoard();

    // currently selected gem starting position. used to stop player form moving gems too far.
    selectedGemStartPos = { x: 0, y: 0 };
    
    // used to disable input while gems are dropping down and respawning
    allowInput = false;

    game.input.addMoveCallback(slideGem, this);

	var style = {font: "32px Arial", fill: "#ffffff", align: "left", stroke: "#000000", strokeThickness:5};
	emojiCounter = game.add.text(0, 0, "...", style);
	updateCounter();
}

function indexToMood(index) {
	if (index == 0) {
		return "Sassy";
	} else if (index == 1) {
		return "Worried";
	} else if (index == 2) {
		return "Cool";
	} else if (index == 3) {
		return "Hmm";
	} else if (index == 4) {
		return "Smug";
	} else {
		console.log("Unknown mood "+index);
		return "uh idk";
	}
}

function currentMood() {
	return indexToMood(killedEmojis.indexOf(Math.max(...killedEmojis))); //arcane magic
}

function updateCounter() {
	var text = "MOOD: "+currentMood()+"\nSassy: "+killedEmojis[0]+"\nWorried: "+killedEmojis[1]+"\nCool: "+killedEmojis[2]+"\nHmm: "+killedEmojis[3]+"\nSmug: "+killedEmojis[4];
	emojiCounter.text = text;
	//emojiCounter.bringToTop();
}

function releaseGem() {

    if (tempShiftedGem === null) {
        selectedGem = null;
        return;
    }

    // when the mouse is released with a gem selected
    // 1) check for matches
    // 2) remove matched gems
    // 3) drop down gems above removed gems
    // 4) refill the board

    var canKill = checkAndKillGemMatches(selectedGem);
    canKill = checkAndKillGemMatches(tempShiftedGem) || canKill;

    if (! canKill) // there are no matches so swap the gems back to the original positions
    {
        var gem = selectedGem;

        if (gem.posX !== selectedGemStartPos.x || gem.posY !== selectedGemStartPos.y)
        {
            if (selectedGemTween !== null)
            {
                game.tweens.remove(selectedGemTween);
            }

            selectedGemTween = tweenGemPos(gem, selectedGemStartPos.x, selectedGemStartPos.y);

            if (tempShiftedGem !== null)
            {
                tweenGemPos(tempShiftedGem, gem.posX, gem.posY);
            }

            swapGemPosition(gem, tempShiftedGem);

            tempShiftedGem = null;

        }
    }

    removeKilledGems();

    var dropGemDuration = dropGems();

    // delay board refilling until all existing gems have dropped down
    game.time.events.add(dropGemDuration * 100, refillBoard);

    allowInput = false;

    selectedGem = null;
    tempShiftedGem = null;

}

function slideGem(pointer, x, y) {

    // check if a selected gem should be moved and do it

    if (selectedGem && pointer.isDown)
    {
        var cursorGemPosX = getGemPos(x);
        var cursorGemPosY = getGemPos(y);

        if (checkIfGemCanBeMovedHere(selectedGemStartPos.x, selectedGemStartPos.y, cursorGemPosX, cursorGemPosY))
        {
            if (cursorGemPosX !== selectedGem.posX || cursorGemPosY !== selectedGem.posY)
            {
                // move currently selected gem
                if (selectedGemTween !== null)
                {
                    game.tweens.remove(selectedGemTween);
                }

                selectedGemTween = tweenGemPos(selectedGem, cursorGemPosX, cursorGemPosY);

                gems.bringToTop(selectedGem);

                // if we moved a gem to make way for the selected gem earlier, move it back into its starting position
                if (tempShiftedGem !== null)
                {
                    tweenGemPos(tempShiftedGem, selectedGem.posX , selectedGem.posY);
                    swapGemPosition(selectedGem, tempShiftedGem);
                }

                // when the player moves the selected gem, we need to swap the position of the selected gem with the gem currently in that position 
                tempShiftedGem = getGem(cursorGemPosX, cursorGemPosY);

                if (tempShiftedGem === selectedGem)
                {
                    tempShiftedGem = null;
                }
                else
                {
                    tweenGemPos(tempShiftedGem, selectedGem.posX, selectedGem.posY);
                    swapGemPosition(selectedGem, tempShiftedGem);
                }
            }
        }
    }
}

// fill the screen with as many gems as possible
function spawnBoard() {

    BOARD_COLS = Math.floor(game.world.width / GEM_SIZE_SPACED);
    BOARD_ROWS = Math.floor(game.world.height / GEM_SIZE_SPACED);

    gems = game.add.group();

    for (var i = 0; i < BOARD_COLS; i++)
    {
        for (var j = 0; j < BOARD_ROWS; j++)
        {
            var gem = gems.create(i * GEM_SIZE_SPACED, j * GEM_SIZE_SPACED, "GEMS");
            gem.name = 'gem' + i.toString() + 'x' + j.toString();
            gem.inputEnabled = true;
            gem.events.onInputDown.add(selectGem, this);
            gem.events.onInputUp.add(releaseGem, this);
            randomizeGemColor(gem);
            setGemPos(gem, i, j); // each gem has a position on the board
            gem.kill();
        }
    }

    removeKilledGems();

    var dropGemDuration = dropGems();

    // delay board refilling until all existing gems have dropped down
    game.time.events.add(dropGemDuration * 100, refillBoard);

    allowInput = false;

    selectedGem = null;
    tempShiftedGem = null;

    // notify the police
	game.time.events.add(Phaser.Timer.SECOND * 15, policeTime, this);
	// game.time.events.add(Phaser.Timer.SECOND * 0, policeTime, this);
}

// select a gem and remember its starting position
function selectGem(gem) {

    if (allowInput)
    {
        selectedGem = gem;
        selectedGemStartPos.x = gem.posX;
        selectedGemStartPos.y = gem.posY;
    }

}

// find a gem on the board according to its position on the board
function getGem(posX, posY) {

    return gems.iterate("id", calcGemId(posX, posY), Phaser.Group.RETURN_CHILD);

}

// convert world coordinates to board position
function getGemPos(coordinate) {

    return Math.floor(coordinate / GEM_SIZE_SPACED);

}

// set the position on the board for a gem
function setGemPos(gem, posX, posY) {

    gem.posX = posX;
    gem.posY = posY;
    gem.id = calcGemId(posX, posY);

}

// the gem id is used by getGem() to find specific gems in the group
// each position on the board has a unique id
function calcGemId(posX, posY) {

    return posX + posY * BOARD_COLS;

}

// since the gems are a spritesheet, their color is the same as the current frame number
function getGemColor(gem) {

    return gem.frame;

}

// set the gem spritesheet to a random frame
function randomizeGemColor(gem) {

    gem.frame = game.rnd.integerInRange(0, gem.animations.frameTotal - 1);

}

// gems can only be moved 1 square up/down or left/right
function checkIfGemCanBeMovedHere(fromPosX, fromPosY, toPosX, toPosY) {

    if (toPosX < 0 || toPosX >= BOARD_COLS || toPosY < 0 || toPosY >= BOARD_ROWS)
    {
        return false;
    }

    if (fromPosX === toPosX && fromPosY >= toPosY - 1 && fromPosY <= toPosY + 1)
    {
        return true;
    }

    if (fromPosY === toPosY && fromPosX >= toPosX - 1 && fromPosX <= toPosX + 1)
    {
        return true;
    }

    return false;
}

// count how many gems of the same color lie in a given direction
// eg if moveX=1 and moveY=0, it will count how many gems of the same color lie to the right of the gem
// stops counting as soon as a gem of a different color or the board end is encountered
function countSameColorGems(startGem, moveX, moveY) {

    var curX = startGem.posX + moveX;
    var curY = startGem.posY + moveY;
    var count = 0;

    while (curX >= 0 && curY >= 0 && curX < BOARD_COLS && curY < BOARD_ROWS && getGemColor(getGem(curX, curY)) === getGemColor(startGem))
    {
        count++;
        curX += moveX;
        curY += moveY;
    }

    return count;

}

// swap the position of 2 gems when the player drags the selected gem into a new location
function swapGemPosition(gem1, gem2) {

    var tempPosX = gem1.posX;
    var tempPosY = gem1.posY;
    setGemPos(gem1, gem2.posX, gem2.posY);
    setGemPos(gem2, tempPosX, tempPosY);

}

// count how many gems of the same color are above, below, to the left and right
// if there are more than 3 matched horizontally or vertically, kill those gems
// if no match was made, move the gems back into their starting positions
function checkAndKillGemMatches(gem) {

    if (gem === null) { return; }

    var canKill = false;

    // process the selected gem

    var countUp = countSameColorGems(gem, 0, -1);
    var countDown = countSameColorGems(gem, 0, 1);
    var countLeft = countSameColorGems(gem, -1, 0);
    var countRight = countSameColorGems(gem, 1, 0);

    var countHoriz = countLeft + countRight + 1;
    var countVert = countUp + countDown + 1;

    if (countVert >= MATCH_MIN)
    {
        killGemRange(gem.posX, gem.posY - countUp, gem.posX, gem.posY + countDown);
        canKill = true;
    }

    if (countHoriz >= MATCH_MIN)
    {
        killGemRange(gem.posX - countLeft, gem.posY, gem.posX + countRight, gem.posY);
        canKill = true;
    }

    return canKill;

}

// kill all gems from a starting position to an end position
function killGemRange(fromX, fromY, toX, toY) {

    fromX = Phaser.Math.clamp(fromX, 0, BOARD_COLS - 1);
    fromY = Phaser.Math.clamp(fromY , 0, BOARD_ROWS - 1);
    toX = Phaser.Math.clamp(toX, 0, BOARD_COLS - 1);
    toY = Phaser.Math.clamp(toY, 0, BOARD_ROWS - 1);

    for (var i = fromX; i <= toX; i++)
    {
        for (var j = fromY; j <= toY; j++)
        {
            var gem = getGem(i, j);
            gem.kill();
        }
    }

}

// move gems that have been killed off the board
// log the emojis the player cleared
function removeKilledGems() {

    gems.forEach(function(gem) {
        if (!gem.alive) {
            setGemPos(gem, -1,-1);
			if (logEmojis) {
				var emoji = gem.animations.currentFrame.index;
				killedEmojis[emoji]++;
				updateCounter();
			}
        }
    });
	//console.log(killedEmojis);
}

// animated gem movement
function tweenGemPos(gem, newPosX, newPosY, durationMultiplier) {

    //console.log('Tween ',gem.name,' from ',gem.posX, ',', gem.posY, ' to ', newPosX, ',', newPosY);
    if (durationMultiplier === null || typeof durationMultiplier === 'undefined')
    {
        durationMultiplier = 1;
    }

    return game.add.tween(gem).to({x: newPosX  * GEM_SIZE_SPACED, y: newPosY * GEM_SIZE_SPACED}, 100 * durationMultiplier, Phaser.Easing.Linear.None, true);

}

// look for gems with empty space beneath them and move them down
function dropGems() {

    var dropRowCountMax = 0;

    for (var i = 0; i < BOARD_COLS; i++)
    {
        var dropRowCount = 0;

        for (var j = BOARD_ROWS - 1; j >= 0; j--)
        {
            var gem = getGem(i, j);

            if (gem === null)
            {
                dropRowCount++;
            }
            else if (dropRowCount > 0)
            {
                gem.dirty = true;
                setGemPos(gem, gem.posX, gem.posY + dropRowCount);
                tweenGemPos(gem, gem.posX, gem.posY, dropRowCount);
            }
        }

        dropRowCountMax = Math.max(dropRowCount, dropRowCountMax);
    }

    return dropRowCountMax;

}

// look for any empty spots on the board and spawn new gems in their place that fall down from above
function refillBoard() {

    var maxGemsMissingFromCol = 0;

    for (var i = 0; i < BOARD_COLS; i++)
    {
        var gemsMissingFromCol = 0;

        for (var j = BOARD_ROWS - 1; j >= 0; j--)
        {
            var gem = getGem(i, j);

            if (gem === null)
            {
                gemsMissingFromCol++;
                gem = gems.getFirstDead();
                gem.reset(i * GEM_SIZE_SPACED, -gemsMissingFromCol * GEM_SIZE_SPACED);
                gem.dirty = true;
                randomizeGemColor(gem);
                setGemPos(gem, i, j);
                tweenGemPos(gem, gem.posX, gem.posY, gemsMissingFromCol * 2);
            }
        }

        maxGemsMissingFromCol = Math.max(maxGemsMissingFromCol, gemsMissingFromCol);
    }

    game.time.events.add(maxGemsMissingFromCol * 2 * 100, boardRefilled);

}

// when the board has finished refilling, re-enable player input
function boardRefilled() {
    var canKill = false;
    for (var i = 0; i < BOARD_COLS; i++)
    {
        for (var j = BOARD_ROWS - 1; j >= 0; j--)
        {
            var gem = getGem(i, j);

            if (gem.dirty)
            {
                gem.dirty = false;
                canKill = checkAndKillGemMatches(gem) || canKill;
            }
        }
    }

    if(canKill){
        removeKilledGems();
        var dropGemDuration = dropGems();
        // delay board refilling until all existing gems have dropped down
        game.time.events.add(dropGemDuration * 100, refillBoard);
        allowInput = false;
    } else {
        allowInput = true;
		logEmojis = true;
    }
}

function policeTime() {
	console.log("police time starto")
	var police = game.add.sprite(462, 800, "POLICE");
	game.physics.enable(police, Phaser.Physics.ARCADE);
	police.body.velocity.y = -50;
	// setTimeout(function() {police.body.velocity.y = 0; textboxTime()}, 11500);
	game.time.events.add(Phaser.Timer.SECOND * 11.5, function() {police.body.velocity.y = 0; textboxTime()}, this);
}

function textboxTime() {
	//give it a little to sink in
	game.time.events.add(Phaser.Timer.SECOND * 2, function() {
		var textbox = game.add.sprite(3, 395, "TEXTBOX");
		var t = "Excuse me, \nWe have reason to believe \nthere are drugs on the premises."
		var style = {font: "28px Arial", fill:"#000000", align:"left"};
		var text = game.add.text(15, 415, t, style);
		game.time.events.add(Phaser.Timer.SECOND * 5, function() {
			text.text = "We would like to conduct an \ninvestigation.\nHowever, if you have something \nto hide... You can say no.";
			// game.time.events.add(Phaser.Timer.SECOND * 1, responseTime);
			game.time.events.add(Phaser.Timer.SECOND * 10, responseTime);
		}, this);
	}, this);
}

function responseTime() {
	var responsebox = game.add.sprite(400, 5, "TEXTBOX");
	var t = "You:\n"+getMoodText()
	var style = {font: "28px Arial", fill:"#000000", align:"left"};
	var text = game.add.text(412, 25, t, style);
	game.time.events.add(Phaser.Timer.SECOND * 5, endTime);
}

function getMoodText() {
	var mood = currentMood();
	if (mood == "Sassy") {
		return "Go ahead, \nsearch the place dummy :P";
	} else if (mood == "Worried") {
		return "UHHHHHH SURE \nJUST DON'T LOOK IN \nTHE CLOSET";
	} else if (mood == "Cool") {
		return "No drugs in here officer,\njust one cool kid.\nB)";
	} else if (mood == "Hmm") {
		confusion = true; //secret wincon
		return "Before you look for drugs...\nJust what IS a drug, really?";
	} else if (mood == "Smug") {
		return "Yeah, go ahead. \nYou won't find anything.\nHeh...";
	}
}

function getSum(total, num) {
	return total + num;
}

function endTime() {
	var total = killedEmojis.reduce(getSum);
	var years = Math.round(total**1.1);
	if (total > 0 && !confusion) {
		var background = game.add.sprite(0, 0 , "DRUGS");
		var t = "GAME OVER.\n\nThe police confiscated the "+total+" pounds\nof cocaine in your house.\n\nYou have been sent to prison\n with a sentence of "+years+" years.";
		var style = {font: "32px Arial", fill:"#FFFFFF", align:"center"};
		var text = game.add.text(50, 75, t, style);
	} else if (total <= 0) {
		var background = game.add.sprite(0, 0 , "BLANK");
		var t = "GAME OVER.\n\nThe police looked for drugs, but couldn't find any.\nWinners don't do drugs!\nGreat job!";
		var style = {font: "32px Arial", fill:"#FFFFFF", align:"center"};
		var text = game.add.text(75, 75, t, style);
	} else if (confusion) {
		var background = game.add.sprite(0, 0 , "BLANK");
		var t = "GAME OVER.\n\nYou confused the policeman into \nforgetting what drugs are.\nThey didn't find the "+total+" pounds \nof cocaine hidden in your closet.\nGood job!";
		var style = {font: "32px Arial", fill:"#FFFFFF", align:"center"};
		var text = game.add.text(75, 75, t, style);
	}
}
